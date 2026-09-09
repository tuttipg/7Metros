#!/usr/bin/env python3
"""7Metros FEMEBAL importer.

Backend/CLI only. Never expose SUPABASE_SERVICE_ROLE_KEY in browser code.
The importer is deliberately idempotent: every source payload receives a SHA-256
fingerprint and ambiguous identities are sent to import_revision instead of guessed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import requests

try:
    from pypdf import PdfReader
except ImportError:  # optional until PDF parsing is requested
    PdfReader = None

TIMEOUT = 30
USER_AGENT = "7Metros/1.0 (+https://github.com/tuttipg/7Metros)"


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^a-zA-Z0-9]+", " ", value).strip().lower()
    return re.sub(r"\s+", " ", value)


def fingerprint(payload: Any) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class MatchRecord:
    fecha: str
    hora: str | None
    jornada: int | None
    local: str
    visitante: str
    categoria: str
    division: str
    rama: str
    goles_local: int | None = None
    goles_visitante: int | None = None
    planilla_url: str | None = None
    programacion_url: str | None = None
    programacion_pdf_url: str | None = None

    @property
    def identity(self) -> str:
        return fingerprint({
            "fecha": self.fecha,
            "local": normalize(self.local),
            "visitante": normalize(self.visitante),
            "categoria": normalize(self.categoria),
            "division": normalize(self.division),
            "rama": self.rama.upper(),
        })


class SupabaseAdmin:
    def __init__(self, url: str, key: str) -> None:
        self.base = url.rstrip("/")
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        }

    def request(self, method: str, table: str, query: str = "", payload: Any = None, prefer: str | None = None) -> Any:
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        response = requests.request(
            method,
            f"{self.base}/rest/v1/{table}{query}",
            headers=headers,
            json=payload,
            timeout=TIMEOUT,
        )
        if not response.ok:
            raise RuntimeError(f"Supabase {response.status_code}: {response.text[:1000]}")
        if not response.text:
            return None
        return response.json()

    def select(self, table: str, query: str) -> list[dict[str, Any]]:
        data = self.request("GET", table, query)
        return data if isinstance(data, list) else []

    def insert(self, table: str, payload: dict[str, Any]) -> list[dict[str, Any]]:
        data = self.request("POST", table, payload=payload, prefer="return=representation")
        return data if isinstance(data, list) else []

    def patch(self, table: str, query: str, payload: dict[str, Any]) -> list[dict[str, Any]]:
        data = self.request("PATCH", table, query=query, payload=payload, prefer="return=representation")
        return data if isinstance(data, list) else []


class Importer:
    def __init__(self, db: SupabaseAdmin | None, season_id: int, dry_run: bool = True) -> None:
        self.db = db
        self.season_id = season_id
        self.dry_run = dry_run
        self.inserted = 0
        self.updated = 0
        self.reviewed = 0

    def teams(self) -> list[dict[str, Any]]:
        if not self.db:
            return []
        return self.db.select("equipos", f"?select=id,club_id,categoria,division,rama,equipo_codigo,nombre_femebal&temporada_id=eq.{self.season_id}")

    def resolve_team(self, name: str, categoria: str, division: str, rama: str, teams: list[dict[str, Any]]) -> dict[str, Any] | None:
        target = normalize(name)
        scoped = [t for t in teams if normalize(t.get("categoria", "")) == normalize(categoria) and normalize(t.get("division", "")) == normalize(division) and str(t.get("rama", "")).upper() == rama.upper()]
        exact = [t for t in scoped if normalize(t.get("nombre_femebal", "")) == target]
        if len(exact) == 1:
            return exact[0]
        contains = [t for t in scoped if target and (target in normalize(t.get("nombre_femebal", "")) or normalize(t.get("nombre_femebal", "")) in target)]
        return contains[0] if len(contains) == 1 else None

    def review(self, kind: str, source: str | None, payload: dict[str, Any], note: str) -> None:
        self.reviewed += 1
        item = {
            "fingerprint": fingerprint({"kind": kind, "source": source, "payload": payload}),
            "tipo": kind,
            "fuente_url": source,
            "payload": payload,
            "estado": "pendiente",
            "observaciones": note,
        }
        if self.dry_run or not self.db:
            print("REVIEW", json.dumps(item, ensure_ascii=False))
            return
        existing = self.db.select("import_revision", f"?select=id&fingerprint=eq.{item['fingerprint']}&limit=1")
        if not existing:
            self.db.insert("import_revision", item)

    def upsert_match(self, record: MatchRecord, teams: list[dict[str, Any]]) -> None:
        home = self.resolve_team(record.local, record.categoria, record.division, record.rama, teams)
        away = self.resolve_team(record.visitante, record.categoria, record.division, record.rama, teams)
        if not home or not away:
            self.review("partido", record.programacion_url, asdict(record), "No se pudo resolver uno o ambos equipos sin ambigüedad.")
            return
        query = f"?select=id,goles_local,goles_visitante,estado&temporada_id=eq.{self.season_id}&fecha=eq.{record.fecha}&local_equipo_id=eq.{home['id']}&visitante_equipo_id=eq.{away['id']}&limit=1"
        existing = self.db.select("partidos", query) if self.db else []
        payload: dict[str, Any] = {
            "temporada_id": self.season_id,
            "fecha": record.fecha,
            "hora": record.hora,
            "jornada": record.jornada,
            "local_equipo_id": home["id"],
            "visitante_equipo_id": away["id"],
            "programacion_url": record.programacion_url,
            "programacion_pdf_url": record.programacion_pdf_url,
            "planilla_url": record.planilla_url,
            "tipo_fuente": "planilla" if record.planilla_url else "programacion",
        }
        if record.goles_local is not None and record.goles_visitante is not None:
            payload.update({"goles_local": record.goles_local, "goles_visitante": record.goles_visitante, "estado": "finalizado"})
        else:
            payload["estado"] = "programado"
        payload = {k: v for k, v in payload.items() if v is not None}
        if self.dry_run or not self.db:
            print("UPDATE" if existing else "INSERT", json.dumps(payload, ensure_ascii=False))
            self.updated += bool(existing); self.inserted += not bool(existing)
            return
        if existing:
            self.db.patch("partidos", f"?id=eq.{existing[0]['id']}", payload); self.updated += 1
        else:
            self.db.insert("partidos", payload); self.inserted += 1

    def ingest(self, records: Iterable[MatchRecord]) -> None:
        teams = self.teams()
        for record in records:
            self.upsert_match(record, teams)


def extract_pdf_text(path_or_url: str) -> str:
    if PdfReader is None:
        raise RuntimeError("Instalá pypdf para procesar PDFs: pip install -r requirements-tools.txt")
    if re.match(r"^https?://", path_or_url):
        response = requests.get(path_or_url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
        response.raise_for_status()
        from io import BytesIO
        source = BytesIO(response.content)
    else:
        source = path_or_url
    reader = PdfReader(source)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def records_from_json(path: Path) -> list[MatchRecord]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        data = data.get("partidos", [])
    if not isinstance(data, list):
        raise ValueError("El JSON debe ser una lista o un objeto con clave 'partidos'.")
    return [MatchRecord(**item) for item in data]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Importador idempotente Fe.Me.Bal. → 7Metros")
    parser.add_argument("--season-id", type=int, default=3)
    parser.add_argument("--apply", action="store_true", help="Aplica cambios. Por defecto es dry-run.")
    sub = parser.add_subparsers(dest="command", required=True)
    json_cmd = sub.add_parser("json", help="Importa registros normalizados desde JSON")
    json_cmd.add_argument("path", type=Path)
    pdf_cmd = sub.add_parser("pdf-text", help="Extrae texto de un PDF para desarrollar/validar parsers")
    pdf_cmd.add_argument("source")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "pdf-text":
        print(extract_pdf_text(args.source))
        return 0
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if args.apply and (not url or not key):
        print("Faltan SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY. No se aplicaron cambios.", file=sys.stderr)
        return 2
    db = SupabaseAdmin(url, key) if url and key else None
    importer = Importer(db, args.season_id, dry_run=not args.apply)
    records = records_from_json(args.path)
    importer.ingest(records)
    print(json.dumps({"leidos": len(records), "insertados": importer.inserted, "actualizados": importer.updated, "revision": importer.reviewed, "dry_run": importer.dry_run}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

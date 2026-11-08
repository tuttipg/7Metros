#!/usr/bin/env python3
"""Clasificador SAFE/DRY RUN de estado de partidos FEMEBAL Community 1.1.3.

Entrada: JSON de un Match devuelto por /matches o /matches/{matchId}.
Salida: preview normalizado. No hace red, no lee ni escribe Supabase y no persiste tokens.
"""

from __future__ import annotations

import argparse
import json
import unicodedata
from pathlib import Path
from typing import Any


PENDING_FINAL = {
    "pend. confirmacion resultado final",
    "pend confirmacion resultado final",
    "pendiente confirmacion resultado final",
}

SHEET_PENDING = {
    "pend. confirmacion",
    "suspendida pend. confirmacion",
    "suspendido pend. confirmacion",
    "suspendida pend confirmacion",
    "suspendido pend confirmacion",
}

SHEET_FINAL = {
    "finalizada",
    "finalizado",
    "finalizada suspendida",
    "finalizado suspendido",
}


def norm(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in text if unicodedata.category(ch) != "Mn")


def score_from_result(result: Any) -> tuple[Any, Any]:
    if not isinstance(result, dict):
        return None, None
    return result.get("homeTeamGoals"), result.get("awayTeamGoals")


def classify(match: dict[str, Any]) -> dict[str, Any]:
    raw_status = norm(match.get("status"))
    sheet_status = norm(match.get("matchSheetStatus"))
    home_goals, away_goals = score_from_result(match.get("result"))
    has_score = home_goals is not None and away_goals is not None

    if raw_status == "programado":
        estado = "programado"
    elif raw_status == "reprogramado":
        estado = "reprogramado"
    elif raw_status == "suspendido":
        estado = "suspendido"
    elif raw_status in {"iniciado", "live"}:
        estado = "en_curso"
    elif raw_status in {"finalizado", "finalized"}:
        estado = "finalizado"
    elif raw_status == "cancelado":
        estado = "cancelado"
    elif raw_status in PENDING_FINAL:
        estado = "pendiente_confirmacion"
    else:
        estado = "desconocido"

    if has_score:
        resultado = "disponible"
    elif raw_status in PENDING_FINAL or sheet_status in SHEET_PENDING:
        resultado = "pendiente_confirmacion"
    elif estado == "cancelado":
        resultado = "no_aplica"
    elif estado in {"programado", "reprogramado", "suspendido", "en_curso", "finalizado"}:
        resultado = "no_disponible"
    else:
        resultado = "desconocido"

    # 'disputado' no es un raw status de 1.1.3. Se deriva solo de evidencia positiva.
    if has_score or estado in {"en_curso", "finalizado", "pendiente_confirmacion"}:
        disputado = True
    elif estado in {"programado", "reprogramado", "cancelado"}:
        disputado = False
    else:
        disputado = None

    warnings: list[str] = []
    if estado == "finalizado" and not has_score:
        warnings.append("finalizado_sin_resultado: no inventar marcador")
    if estado == "suspendido":
        warnings.append("suspendido_no_indica_si_el_juego_habia_comenzado")
    if raw_status == "cancelado":
        warnings.append("cancelado_es_terminal_pero_no_prueba_partido_disputado")
    if sheet_status in {"en juego", "iniciada"} and estado not in {"en_curso", "desconocido"}:
        warnings.append("conflicto_status_vs_matchSheetStatus: revision_manual")
    if sheet_status in SHEET_FINAL and estado not in {"finalizado", "suspendido", "desconocido"}:
        warnings.append("planilla_final_pero_estado_no_terminal: revision_manual")

    return {
        "matchId": match.get("id"),
        "tournamentId": match.get("tournamentId"),
        "homeTeamId": (match.get("homeTeam") or {}).get("id") if isinstance(match.get("homeTeam"), dict) else None,
        "awayTeamId": (match.get("awayTeam") or {}).get("id") if isinstance(match.get("awayTeam"), dict) else None,
        "rawStatus": match.get("status"),
        "rawMatchSheetStatus": match.get("matchSheetStatus"),
        "estadoActualDryRun": estado,
        "resultadoOficialDryRun": resultado,
        "disputadoConfirmadoDryRun": disputado,
        "scorePreview": {
            "homeTeamGoals": home_goals,
            "awayTeamGoals": away_goals,
        } if has_score else None,
        "finishedAt": match.get("finishedAt"),
        "safeToAutoupdate": bool(match.get("id")) and estado != "desconocido" and not warnings,
        "warnings": warnings,
        "writeEnabled": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("json_file", type=Path)
    args = parser.parse_args()

    payload = json.loads(args.json_file.read_text(encoding="utf-8"))
    matches: list[dict[str, Any]]
    if isinstance(payload, dict) and isinstance(payload.get("items"), list):
        matches = [x for x in payload["items"] if isinstance(x, dict)]
    elif isinstance(payload, list):
        matches = [x for x in payload if isinstance(x, dict)]
    elif isinstance(payload, dict):
        matches = [payload]
    else:
        raise SystemExit("JSON no reconocido")

    output = {
        "mode": "SAFE_DRY_RUN",
        "writeEnabled": False,
        "count": len(matches),
        "items": [classify(m) for m in matches],
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

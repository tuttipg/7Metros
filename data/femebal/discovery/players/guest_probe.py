#!/usr/bin/env python3
"""Read-only FEMEBAL Community 1.1.3 guest probe for ONE athlete.

Usage:
    python data/femebal/discovery/players/guest_probe.py "Agustin Unzner"

Tokens remain only in process memory. The probe does not call document/federative-card,
roster enumeration, matches/results, Supabase, or write endpoints.
"""
from __future__ import annotations

import json
import sys
import time
import unicodedata
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE = "https://api.femebal.cam.larrysport.tecdata.net"
HEADERS = {
    "Accept": "application/json",
    "X-App-Variant": "cah",
    "X-App-Version": "1.1.3",
}
OUT = Path(__file__).with_name("players_runtime_sample.json")


def norm(value):
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(c for c in text if not unicodedata.combining(c))
    return " ".join(text.casefold().split())


def sanitize(value):
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            k = str(key).casefold()
            out[key] = "[REDACTED]" if "token" in k or k in {"authorization", "cookie", "set-cookie"} else sanitize(item)
        return out
    if isinstance(value, list):
        return [sanitize(item) for item in value]
    return value


def request_json(method, path, token=None):
    headers = dict(HEADERS)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = Request(BASE + path, data=b"" if method == "POST" else None, headers=headers, method=method)
    try:
        with urlopen(req, timeout=20) as response:
            status, raw = int(response.status), response.read()
    except HTTPError as exc:
        status, raw = int(exc.code), exc.read()
    except URLError as exc:
        raise RuntimeError(f"Network error before HTTP response: {exc}") from exc
    text = raw.decode("utf-8", errors="replace")
    try:
        body = json.loads(text) if text else None
    except json.JSONDecodeError:
        body = {"_nonJsonBody": text[:1000]}
    if not 200 <= status < 300:
        raise RuntimeError(f"{method} {path} -> HTTP {status}: {json.dumps(sanitize(body), ensure_ascii=False)[:1000]}")
    return status, body


def name_of(item):
    if not isinstance(item, dict):
        return ""
    return f"{item.get('firstName') or ''} {item.get('lastName') or ''}".strip()


def contexts(items):
    rows = []
    if not isinstance(items, list):
        return rows
    for item in items:
        if not isinstance(item, dict):
            continue
        team = item.get("team") if isinstance(item.get("team"), dict) else {}
        tournament = item.get("tournament") if isinstance(item.get("tournament"), dict) else {}
        club = team.get("club") if isinstance(team.get("club"), dict) else {}
        rows.append({
            "teamId": team.get("id"),
            "teamName": team.get("name"),
            "clubId": club.get("id"),
            "clubName": club.get("name"),
            "teamAgeCategory": team.get("ageCategory"),
            "teamDivision": team.get("division"),
            "teamGender": team.get("gender"),
            "tournamentId": tournament.get("id"),
            "tournamentName": tournament.get("name"),
            "tournamentAgeCategory": tournament.get("ageCategory"),
            "tournamentDivision": tournament.get("division"),
            "tournamentGender": tournament.get("gender"),
            "season": tournament.get("season"),
            "tournamentStatus": tournament.get("status"),
            "tournamentRelevant": tournament.get("isRelevant"),
        })
    return rows


def main():
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print('Usage: python guest_probe.py "Nombre Apellido"', file=sys.stderr)
        return 2
    query = sys.argv[1].strip()
    result = {
        "contractVersion": "femebal-community-1.1.3",
        "query": query,
        "runtimeConfirmed": False,
        "calls": [],
        "safety": {
            "guestFlowOnly": True,
            "tokensPersisted": False,
            "federativeCardCalled": False,
            "documentLookupCalled": False,
            "bulkRosterCalled": False,
            "writesPerformed": False,
        },
    }

    status, init = request_json("POST", "/init-onboarding")
    if not isinstance(init, dict) or not isinstance(init.get("accessToken"), str) or not init.get("accessToken"):
        raise RuntimeError("init-onboarding did not expose the top-level accessToken expected by client 1.1.3")
    token = init["accessToken"]
    result["calls"].append({
        "method": "POST", "path": "/init-onboarding", "httpStatus": status,
        "responseKeys": sorted(init.keys()), "accessTokenPresent": True,
        "refreshTokenPresent": bool(init.get("refreshToken")), "responseBodyPersisted": False,
    })

    search_path = "/search?" + urlencode({"query": query, "type": "athletes", "skip": 0})
    status, search = request_json("GET", search_path, token)
    result["calls"].append({"method": "GET", "path": search_path, "httpStatus": status})
    athletes = search.get("athletes") if isinstance(search, dict) else None
    if not isinstance(athletes, list):
        raise RuntimeError("/search response does not contain an athletes array")

    exact = [a for a in athletes if norm(name_of(a)) == norm(query)]
    if len(exact) == 1:
        selected = exact[0]
    elif len(athletes) == 1:
        selected = athletes[0]
    else:
        result["status"] = "needs_disambiguation"
        result["search"] = {
            "limit": search.get("limit"), "skip": search.get("skip"),
            "candidateCount": len(athletes),
            "candidates": [{"id": a.get("id"), "firstName": a.get("firstName"), "lastName": a.get("lastName")} for a in athletes[:20] if isinstance(a, dict)],
        }
        OUT.write_text(json.dumps(sanitize(result), ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Saved {OUT}; no athlete selected because the result was ambiguous.")
        return 3

    athlete_id = str(selected.get("id") or "").strip() if isinstance(selected, dict) else ""
    if not athlete_id:
        raise RuntimeError("Selected athlete has no id; refusing to guess")

    paths = {
        "athlete": f"/athletes/{athlete_id}",
        "profile": f"/users/athlete-profile/{athlete_id}",
        "contexts": f"/athletes/{athlete_id}/tournaments",
        "defaultTeam": f"/athletes/{athlete_id}/default-team",
        "clubId": f"/athletes/{athlete_id}/club-id",
        "positionAndNumber": "/athletes/formation/positionAndNumber?" + urlencode({"athleteIds": athlete_id}),
    }
    raw = {}
    for key, path in paths.items():
        time.sleep(0.25)
        status, body = request_json("GET", path, token)
        raw[key] = body
        result["calls"].append({"method": "GET", "path": path, "httpStatus": status})

    athlete = raw["athlete"] if isinstance(raw["athlete"], dict) else {}
    profile = raw["profile"] if isinstance(raw["profile"], dict) else {}
    result.update({
        "status": "ok",
        "runtimeConfirmed": True,
        "searchMeta": {"limit": search.get("limit"), "skip": search.get("skip"), "returnedAthletes": len(athletes)},
        "record": {
            "athleteId": athlete.get("id", athlete_id),
            "firstName": athlete.get("firstName"), "lastName": athlete.get("lastName"),
            "birthDate": athlete.get("birthDate"), "picture": athlete.get("picture"), "avatarUrl": athlete.get("avatarUrl"),
            "profile": {key: profile.get(key) for key in ["userId", "alias", "status", "shirtNumber", "height", "position", "useFederationPicture", "worldMessage", "socialMedia", "avatarUrl", "avatarType"]},
            "contexts": contexts(raw["contexts"]),
            "defaultTeam": raw["defaultTeam"], "clubId": raw["clubId"], "positionAndNumber": raw["positionAndNumber"],
        },
        "rawSanitized": raw,
    })
    OUT.write_text(json.dumps(sanitize(result), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {OUT}; athleteId={athlete_id}; tokens were not persisted.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)

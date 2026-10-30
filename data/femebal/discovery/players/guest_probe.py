#!/usr/bin/env python3
"""SAFE placeholder for the historical FEMEBAL Community player probe.

This file intentionally performs no network access. The previous implementation
used POST /init-onboarding, obtained access/refresh tokens and then sent an
Authorization: Bearer header. That flow is outside the 7Metros SAFE discovery
boundary and must not be executed by this repository's autonomous discovery.

Static player/API evidence belongs in:
    data/femebal/discovery/players/static-contract.json
    docs/femebal/players/discovery-1.1.3.md

No credentials, tokens, cookies, Authorization headers or Supabase writes are
requested or used here.
"""
from __future__ import annotations

import sys


def main() -> int:
    print(
        "SAFE boundary: runtime FEMEBAL Community guest probing is disabled. "
        "Use the static 1.1.3 contract instead; no network request was made.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

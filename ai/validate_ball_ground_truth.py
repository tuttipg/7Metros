"""Validate human ball annotations without treating uncertain frames as negatives."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from sevenmetros_ai.ball_ground_truth import validate_ball_ground_truth


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("annotation")
    parser.add_argument("--source-video")
    parser.add_argument(
        "--require-visible",
        action="store_true",
        help="fail when the sequence contains no visible, localisable ball frame",
    )
    args = parser.parse_args()
    document = json.loads(Path(args.annotation).read_text(encoding="utf-8"))
    summary = validate_ball_ground_truth(document, source_video=args.source_video)
    print(json.dumps(summary.to_dict(), indent=2))
    if args.require_visible and not summary.evaluable_localisation:
        raise SystemExit("sequence has no visible ball boxes; localisation metrics are invalid")


if __name__ == "__main__":
    main()

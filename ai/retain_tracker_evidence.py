"""Retain compact hashed ranges from large tracker JSONLs for later TrackEval."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from sevenmetros_ai.evidence_slices import parse_frame_range, retain_tracking_slices


def parse_tracker(value: str) -> tuple[str, str]:
    if "=" not in value:
        raise argparse.ArgumentTypeError("--tracker must use NAME=PATH")
    name, path = value.split("=", 1)
    if not name.strip() or not path.strip():
        raise argparse.ArgumentTypeError("--tracker must use non-empty NAME=PATH")
    return name.strip(), path.strip()


def parse_range(value: str) -> tuple[int, int]:
    try:
        return parse_frame_range(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tracker", action="append", type=parse_tracker, required=True)
    parser.add_argument("--range", dest="ranges", action="append", type=parse_range, required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    trackers = {}
    for name, path in args.tracker:
        if name in trackers:
            parser.error(f"Duplicate tracker name: {name}")
        trackers[name] = Path(path)

    try:
        manifest = retain_tracking_slices(trackers, args.ranges, Path(args.output))
    except (ValueError, FileNotFoundError) as exc:
        parser.error(str(exc))
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()

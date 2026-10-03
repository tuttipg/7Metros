#!/usr/bin/env python3
"""Validate one YOLO ball dataset before any training run."""
import argparse
import json
import sys
from pathlib import Path

from sevenmetros_ai.ball_training_dataset import (
    dataset_rejection_report,
    load_dataset_yaml,
    validate_yolo_dataset,
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-yaml", required=True, type=Path)
    parser.add_argument("--holdout-manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if args.output.exists():
        parser.error(f"refusing to overwrite existing output: {args.output}")
    try:
        holdout = json.loads(args.holdout_manifest.read_text(encoding="utf-8"))
        report = validate_yolo_dataset(
            load_dataset_yaml(args.data_yaml), args.data_yaml, holdout,
        )
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as exc:
        report = dataset_rejection_report(
            args.data_yaml, args.holdout_manifest, exc,
        )
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(report, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        print(json.dumps({
            "status": report["status"],
            "error": report["error"],
        }, sort_keys=True), file=sys.stderr)
        return 2
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": report["status"],
        "images": report["totals"]["image_count"],
        "boxes": report["totals"]["box_count"],
        "dataset_fingerprint_sha256": report["dataset"]["fingerprint_sha256"],
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

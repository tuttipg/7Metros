#!/usr/bin/env python3
"""Screen external training-source terms without downloading or training."""
import argparse
import hashlib
import json
from pathlib import Path

from sevenmetros_ai.ball_training_sources import PASSED, screen_training_sources


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument(
        "--intended-use",
        choices=("product", "research_noncommercial"),
        required=True,
    )
    parser.add_argument("--output")
    args = parser.parse_args()
    manifest_path = Path(args.manifest)
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        report = {
            "schema": "sevenmetros.ball-training-source-screen/v1",
            "status": "REJECTED_TRAINING_SOURCE_RIGHTS",
            "intended_use": args.intended_use,
            "dataset_admission_status": "NOT_EVALUATED",
            "model_accuracy_status": "NOT_EVALUATED",
            "errors": [f"invalid source manifest: {exc}"],
        }
    else:
        report = screen_training_sources(payload, args.intended_use)
    report["manifest_path"] = str(manifest_path)
    if manifest_path.is_file():
        report["manifest_sha256"] = hashlib.sha256(
            manifest_path.read_bytes()
        ).hexdigest()
    rendered = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        output = Path(args.output)
        if output.exists():
            raise SystemExit(f"refusing to overwrite {output}")
        output.write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0 if report["status"] == PASSED else 2


if __name__ == "__main__":
    raise SystemExit(main())

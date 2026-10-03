#!/usr/bin/env python3
"""Screen one local specialized handball detector for held-out evaluation."""
import argparse
import json
from pathlib import Path

from sevenmetros_ai.ball_model_admission import ADMITTED, admit_ball_model


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--provenance", required=True)
    parser.add_argument("--evaluation-video-sha256", required=True)
    parser.add_argument("--output")
    args = parser.parse_args()
    report = admit_ball_model(args.model, args.provenance, args.evaluation_video_sha256)
    rendered = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        Path(args.output).write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0 if report["status"] == ADMITTED else 2


if __name__ == "__main__":
    raise SystemExit(main())

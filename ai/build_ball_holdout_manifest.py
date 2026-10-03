#!/usr/bin/env python3
"""Fingerprint every real frame reserved for held-out ball evaluation."""
import argparse
import json
from pathlib import Path

from sevenmetros_ai.ball_holdout import (
    build_holdout_manifest,
    build_perceptual_holdout_manifest,
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True)
    parser.add_argument("--detection-cache", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument(
        "--perceptual", action="store_true",
        help="also store strict dHash/pHash fingerprints for recoded/resized copies",
    )
    args = parser.parse_args()
    output = Path(args.output)
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite: {output}")
    builder = build_perceptual_holdout_manifest if args.perceptual else build_holdout_manifest
    manifest = builder(args.video, args.detection_cache)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(output),
        "frame_count": manifest["frame_count"],
        "frames_fingerprint_sha256": manifest["frames_fingerprint_sha256"],
    }, indent=2))


if __name__ == "__main__":
    main()

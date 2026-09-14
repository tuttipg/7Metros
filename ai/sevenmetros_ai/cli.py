from __future__ import annotations

import argparse
import json

from .detectors import UltralyticsPersonDetector
from .pipeline import analyze_video


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="7metros-ai", description="Baseline offline video analysis for 7Metros.")
    parser.add_argument("--video", required=True, help="Input match video path")
    parser.add_argument("--output-jsonl", default="artifacts/tracks.jsonl")
    parser.add_argument("--output-video", default=None, help="Optional annotated MP4 with boxes and persistent track IDs")
    parser.add_argument("--model", default="yolo11n.pt")
    parser.add_argument("--confidence", type=float, default=0.25)
    parser.add_argument("--device", default=None)
    parser.add_argument("--max-distance", type=float, default=80.0)
    parser.add_argument("--max-missed", type=int, default=8)
    parser.add_argument("--max-frames", type=int, default=None)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    detector = UltralyticsPersonDetector(model=args.model, confidence=args.confidence, device=args.device)
    summary = analyze_video(
        args.video,
        detector,
        output_jsonl=args.output_jsonl,
        output_video=args.output_video,
        max_distance=args.max_distance,
        max_missed=args.max_missed,
        max_frames=args.max_frames,
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

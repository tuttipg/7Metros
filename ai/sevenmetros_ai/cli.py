from __future__ import annotations

import argparse
import json
from pathlib import Path
import hashlib

from .detectors import UltralyticsPersonDetector
from .pipeline import analyze_video
from .teams import JerseyColorTeamClassifier


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
    parser.add_argument('--team-references', help='JSON mapping team_a/team_b to RGB triples; optional')
    parser.add_argument('--output-summary', help='Save metrics, configuration and input SHA256 as JSON')
    return parser


def main() -> int:
    args = build_parser().parse_args()
    paths = [Path(p).resolve() for p in (args.video, args.output_jsonl,
             args.output_video, args.output_summary, args.team_references) if p]
    if len(paths) != len(set(paths)):
        raise ValueError('Input, references and output paths must be distinct')
    classifier = None
    if args.team_references:
        refs = json.loads(Path(args.team_references).read_text(encoding='utf-8'))
        if not isinstance(refs, dict) or len(refs) != 2:
            raise ValueError('Provide exactly two team RGB references')
        for name, rgb in refs.items():
            if not name or not isinstance(rgb, list) or len(rgb) != 3 or any(
                not isinstance(v, (int, float)) or isinstance(v, bool) or not 0 <= v <= 255 for v in rgb
            ):
                raise ValueError('RGB references require three finite numbers in [0,255]')
        classifier = JerseyColorTeamClassifier(refs)
    detector = UltralyticsPersonDetector(model=args.model, confidence=args.confidence, device=args.device)
    summary = analyze_video(
        args.video,
        detector,
        output_jsonl=args.output_jsonl,
        output_video=args.output_video,
        max_distance=args.max_distance,
        max_missed=args.max_missed,
        max_frames=args.max_frames,
        team_classifier=classifier,
    )
    digest = hashlib.sha256()
    with Path(args.video).open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    summary['input_sha256'] = digest.hexdigest()
    summary['configuration'] = vars(args)
    summary['team_references'] = classifier.references if classifier else None
    if args.output_summary:
        target = Path(args.output_summary)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

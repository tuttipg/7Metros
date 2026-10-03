"""Compare COCO sports-ball model capacity on one fixed real-video window.

This benchmark changes only the YOLO weight file. Detection class, image size,
confidence thresholds and BallObservationTracker policy remain fixed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from sevenmetros_ai.ball import YoloSportsBallDetector
from sevenmetros_ai.ball_tracking import BallObservationTracker


def sha256_file(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def longest_contiguous_run(observations):
    longest = current = 0
    previous_frame = previous_segment = None
    for item in observations:
        frame, segment = item["frame"], item["segment_id"]
        if previous_frame is not None and frame == previous_frame + 1 and segment == previous_segment:
            current += 1
        else:
            current = 1
        longest = max(longest, current)
        previous_frame, previous_segment = frame, segment
    return longest


def run_model(video, model, *, fixture_start, source_frame_offset, frames, imgsz,
              inference_confidence, low_threshold, high_threshold):
    try:
        import cv2
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("OpenCV is required") from exc
    detector = YoloSportsBallDetector(model, confidence=inference_confidence, imgsz=imgsz)
    tracker = BallObservationTracker(low_threshold=low_threshold, high_threshold=high_threshold)
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {video}")
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(source_frame_offset + fixture_start))
    raw_candidates = candidate_frames = 0
    threshold_counts = {"ge_0_10": 0, "ge_0_05": 0, "ge_0_02": 0}
    max_confidence = 0.0
    selected = []
    try:
        for fixture_frame in range(int(fixture_start), int(fixture_start + frames)):
            ok, frame = cap.read()
            if not ok:
                raise RuntimeError(f"Video ended at fixture frame {fixture_frame}")
            detections = detector.detect(frame)
            raw_candidates += len(detections)
            candidate_frames += int(bool(detections))
            for detection in detections:
                c = float(detection.confidence)
                max_confidence = max(max_confidence, c)
                threshold_counts["ge_0_10"] += int(c >= .10)
                threshold_counts["ge_0_05"] += int(c >= .05)
                threshold_counts["ge_0_02"] += int(c >= .02)
            observation = tracker.update(fixture_frame, detections)
            if observation is not None:
                selected.append({
                    "frame": fixture_frame,
                    "segment_id": int(observation.segment_id),
                    "stage": observation.stage,
                    "confidence": float(observation.detection.confidence),
                    "center": [float(observation.detection.cx), float(observation.detection.cy)],
                })
    finally:
        cap.release()
    longest = longest_contiguous_run(selected)
    return {
        "model_sha256": sha256_file(model),
        "raw_candidates": raw_candidates,
        "candidate_frames": candidate_frames,
        "max_confidence": max_confidence,
        **threshold_counts,
        "tracker_selected": len(selected),
        "longest_contiguous_run": longest,
        "usable_flight": longest >= 3,
        "selected": selected,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True)
    parser.add_argument("--models", nargs="+", required=True, help="YOLO weight files")
    parser.add_argument("--output", required=True)
    parser.add_argument("--fixture-start", type=int, default=326)
    parser.add_argument("--source-frame-offset", type=int, default=900)
    parser.add_argument("--frames", type=int, default=15)
    parser.add_argument("--imgsz", type=int, default=960)
    parser.add_argument("--inference-confidence", type=float, default=.005)
    parser.add_argument("--low-threshold", type=float, default=.02)
    parser.add_argument("--high-threshold", type=float, default=.10)
    args = parser.parse_args()
    payload = {
        "fixture_frames": [args.fixture_start, args.fixture_start + args.frames],
        "source_frame_offset": args.source_frame_offset,
        "settings": {
            "imgsz": args.imgsz,
            "inference_confidence": args.inference_confidence,
            "low_threshold": args.low_threshold,
            "high_threshold": args.high_threshold,
        },
        "models": {},
    }
    for model in args.models:
        path = Path(model)
        payload["models"][path.name] = run_model(
            Path(args.video), path,
            fixture_start=args.fixture_start,
            source_frame_offset=args.source_frame_offset,
            frames=args.frames,
            imgsz=args.imgsz,
            inference_confidence=args.inference_confidence,
            low_threshold=args.low_threshold,
            high_threshold=args.high_threshold,
        )
    Path(args.output).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()

"""Compare raw, scene-guarded and temporal ball candidates on human GT.

The temporal candidate never interpolates a missing ball position: it may only
select one detector box that exists in the current frame.  Neural inference is
run once at the configured low threshold and every comparison is derived from
those persisted boxes.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from sevenmetros_ai.ball import YoloSportsBallDetector
from sevenmetros_ai.ball_ground_truth import (
    evaluate_ball_ground_truth,
    sha256_file,
    validate_ball_ground_truth,
)
from sevenmetros_ai.ball_tracking import BallObservationTracker
from sevenmetros_ai.fixture_filter import blue_court_fraction


def _serialized(detection):
    return {
        "confidence": float(detection.confidence),
        "bbox_xyxy": [
            float(detection.x1), float(detection.y1),
            float(detection.x2), float(detection.y2),
        ],
    }


def replay_sequence(
    rows,
    court_fractions,
    *,
    low_threshold=.02,
    high_threshold=.05,
    max_missed=4,
    min_court_fraction=.15,
):
    """Derive auditable control/guard/temporal boxes from persisted detections."""
    tracker = BallObservationTracker(
        low_threshold=low_threshold,
        high_threshold=high_threshold,
        max_missed=max_missed,
    )
    control, guarded, temporal, decisions = {}, {}, {}, []
    for frame_index in sorted(rows):
        detections = list(rows[frame_index])
        strong = [item for item in detections if item.confidence >= high_threshold]
        court_present = float(court_fractions[frame_index]) >= min_court_fraction
        scene_candidates = detections if court_present else []
        selected = tracker.update(frame_index, scene_candidates)
        control[frame_index] = [_serialized(item) for item in strong]
        guarded[frame_index] = control[frame_index] if court_present else []
        temporal[frame_index] = (
            [_serialized(selected.detection)] if selected is not None else []
        )
        decisions.append({
            "frame_index": frame_index,
            "largest_blue_court_fraction": float(court_fractions[frame_index]),
            "court_present": court_present,
            "raw_low_candidates": len(detections),
            "raw_strong_candidates": len(strong),
            "guarded_strong_candidates": len(guarded[frame_index]),
            "temporal_candidates": len(temporal[frame_index]),
            "temporal_segment_id": (
                selected.segment_id if selected is not None else None
            ),
            "temporal_stage": selected.stage if selected is not None else None,
        })
    return control, guarded, temporal, decisions


def benchmark(
    video,
    model,
    ground_truth_paths,
    *,
    low_threshold=.02,
    high_threshold=.05,
    imgsz=960,
    max_missed=4,
    min_court_fraction=.15,
):
    try:
        import cv2
    except ImportError as exc:  # pragma: no cover - optional vision runtime
        raise RuntimeError("OpenCV is required") from exc
    if not 0 < float(low_threshold) <= float(high_threshold) <= 1:
        raise ValueError("require 0 < low_threshold <= high_threshold <= 1")
    video, model = Path(video), Path(model)
    documents, annotations = [], []
    for path in ground_truth_paths:
        document = json.loads(Path(path).read_text(encoding="utf-8"))
        validate_ball_ground_truth(document, source_video=video)
        documents.append(document)
        annotations.extend(document["annotations"])
    evaluable = [
        row["frame_index"] for row in annotations
        if row["state"] in {"visible", "out_of_frame"}
    ]
    if len(evaluable) != len(set(evaluable)):
        raise ValueError("ground-truth documents contain duplicate evaluable frames")

    detector = YoloSportsBallDetector(
        model, confidence=low_threshold, imgsz=imgsz,
    )
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {video}")
    control_predictions = {}
    guarded_predictions = {}
    temporal_predictions = {}
    raw_low_predictions = {}
    sensitivity_predictions = {value: {} for value in (3, 4, 5)}
    decisions = []
    try:
        for document in documents:
            sequence = document["sequence"]
            start = sequence["start_frame"]
            end = sequence["end_frame_exclusive"]
            cap.set(cv2.CAP_PROP_POS_FRAMES, start)
            raw_rows, fractions = {}, {}
            for frame_index in range(start, end):
                ok, frame = cap.read()
                if not ok:
                    raise RuntimeError(f"Video ended before frame {frame_index}")
                raw_rows[frame_index] = detector.detect(frame)
                fractions[frame_index] = blue_court_fraction(frame)
            control, guarded, temporal, sequence_decisions = replay_sequence(
                raw_rows,
                fractions,
                low_threshold=low_threshold,
                high_threshold=high_threshold,
                max_missed=max_missed,
                min_court_fraction=min_court_fraction,
            )
            sensitivity_temporal = {}
            for candidate_max_missed in sensitivity_predictions:
                sensitivity_temporal[candidate_max_missed] = replay_sequence(
                    raw_rows,
                    fractions,
                    low_threshold=low_threshold,
                    high_threshold=high_threshold,
                    max_missed=candidate_max_missed,
                    min_court_fraction=min_court_fraction,
                )[2]
            evaluable_in_sequence = {
                row["frame_index"] for row in document["annotations"]
                if row["state"] in {"visible", "out_of_frame"}
            }
            for frame_index in evaluable_in_sequence:
                raw_low_predictions[frame_index] = [
                    _serialized(item) for item in raw_rows[frame_index]
                ]
                control_predictions[frame_index] = control[frame_index]
                guarded_predictions[frame_index] = guarded[frame_index]
                temporal_predictions[frame_index] = temporal[frame_index]
                for candidate_max_missed, candidate_rows in sensitivity_temporal.items():
                    sensitivity_predictions[candidate_max_missed][frame_index] = (
                        candidate_rows[frame_index]
                    )
            for row in sequence_decisions:
                row["sequence"] = sequence["name"]
                row["evaluable"] = row["frame_index"] in evaluable_in_sequence
            decisions.extend(sequence_decisions)
    finally:
        cap.release()

    control_metrics = evaluate_ball_ground_truth(annotations, control_predictions)
    guarded_metrics = evaluate_ball_ground_truth(annotations, guarded_predictions)
    temporal_metrics = evaluate_ball_ground_truth(annotations, temporal_predictions)
    sensitivity_metrics = {
        str(value): evaluate_ball_ground_truth(annotations, predictions)
        for value, predictions in sensitivity_predictions.items()
    }
    verified = (
        temporal_metrics["matched"] >= guarded_metrics["matched"]
        and temporal_metrics["false_negatives_on_visible_frames"]
        <= guarded_metrics["false_negatives_on_visible_frames"]
        and temporal_metrics["false_positive_candidates_on_evaluable_frames"]
        <= guarded_metrics["false_positive_candidates_on_evaluable_frames"]
        and temporal_metrics["longest_consecutive_visible_miss_run"]
        <= guarded_metrics["longest_consecutive_visible_miss_run"]
    )
    return {
        "status": (
            "TEMPORAL_SELECTION_VERIFIED_ON_REVIEWED_SAMPLE_NOT_MATCH_ACCURACY"
            if verified else
            "TEMPORAL_SELECTION_REJECTED_ON_REVIEWED_SAMPLE"
        ),
        "processing": {
            "detector": "NEW_NEURAL_INFERENCE_ON_EVERY_FRAME_OF_LISTED_GT_SEQUENCES",
            "comparisons": "SAME_RUN_PERSISTED_BOX_THRESHOLD_GUARD_AND_TEMPORAL_SELECTION",
            "synthetic_ball_positions": 0,
        },
        "inputs": {
            "video_sha256": sha256_file(video),
            "model_sha256": sha256_file(model),
            "ground_truth_files": [str(path) for path in ground_truth_paths],
        },
        "settings": {
            "low_threshold": float(low_threshold),
            "high_threshold": float(high_threshold),
            "imgsz": int(imgsz),
            "max_missed": int(max_missed),
            "min_largest_blue_court_fraction": float(min_court_fraction),
        },
        "requirements": {
            "matched_delta_vs_guard_min": 0,
            "visible_false_negative_delta_vs_guard_max": 0,
            "false_positive_delta_vs_guard_max": 0,
            "longest_visible_miss_run_delta_vs_guard_max": 0,
        },
        "raw_strong_control": control_metrics,
        "blue_court_guard": guarded_metrics,
        "blue_court_plus_temporal": temporal_metrics,
        "max_missed_sensitivity": sensitivity_metrics,
        "predictions": {
            "raw_low_threshold": {
                str(k): v for k, v in raw_low_predictions.items()
            },
            "raw_strong_control": {str(k): v for k, v in control_predictions.items()},
            "blue_court_guard": {str(k): v for k, v in guarded_predictions.items()},
            "blue_court_plus_temporal": {str(k): v for k, v in temporal_predictions.items()},
        },
        "frames": decisions,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--ground-truth", action="append", required=True)
    parser.add_argument("--low-threshold", type=float, default=.02)
    parser.add_argument("--high-threshold", type=float, default=.05)
    parser.add_argument("--imgsz", type=int, default=960)
    parser.add_argument("--max-missed", type=int, default=4)
    parser.add_argument("--min-court-fraction", type=float, default=.15)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output = Path(args.output)
    if output.exists():
        raise ValueError(f"Output already exists: {output}")
    result = benchmark(
        args.video,
        args.model,
        args.ground_truth,
        low_threshold=args.low_threshold,
        high_threshold=args.high_threshold,
        imgsz=args.imgsz,
        max_missed=args.max_missed,
        min_court_fraction=args.min_court_fraction,
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

"""Compare raw, scene-guarded and temporal ball candidates on human GT.

The temporal candidate never interpolates a missing ball position: it may only
select one detector box that exists in the current frame. Neural inference may
be run once at the configured low threshold and persisted in a strict cache;
every comparison and replay is derived from those exact boxes.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from sevenmetros_ai.ball import (
    COCO_SPORTS_BALL_CLASS_ID,
    YoloSportsBallDetector,
    normalize_ball_class_id,
)
from sevenmetros_ai.ball_ground_truth import (
    evaluate_ball_ground_truth,
    sha256_file,
    validate_ball_ground_truth,
)
from sevenmetros_ai.ball_tracking import BallObservationTracker
from sevenmetros_ai.fixture_filter import blue_court_fraction
from sevenmetros_ai.tracking import Detection


BALL_CACHE_SCHEMA = "sevenmetros.ball-detection-cache/v1"


def _serialized(detection):
    return {
        "confidence": float(detection.confidence),
        "bbox_xyxy": [
            float(detection.x1), float(detection.y1),
            float(detection.x2), float(detection.y2),
        ],
    }


def _sequence_specs(documents):
    return [
        {
            "name": document["sequence"]["name"],
            "start_frame": document["sequence"]["start_frame"],
            "end_frame_exclusive": document["sequence"]["end_frame_exclusive"],
        }
        for document in documents
    ]


def _expected_sequence_frames(documents):
    frames = [
        frame_index
        for sequence in _sequence_specs(documents)
        for frame_index in range(
            sequence["start_frame"], sequence["end_frame_exclusive"],
        )
    ]
    if len(frames) != len(set(frames)):
        raise ValueError("ground-truth sequence intervals overlap")
    return frames


def _deserialize_detection(payload, frame_index):
    if not isinstance(payload, dict):
        raise ValueError(f"cache frame {frame_index}: detection must be an object")
    bbox = payload.get("bbox_xyxy")
    if not isinstance(bbox, list) or len(bbox) != 4:
        raise ValueError(f"cache frame {frame_index}: bbox_xyxy must contain four values")
    try:
        x1, y1, x2, y2 = map(float, bbox)
        confidence = float(payload["confidence"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"cache frame {frame_index}: invalid detection values") from exc
    if not (x1 < x2 and y1 < y2 and 0 <= confidence <= 1):
        raise ValueError(f"cache frame {frame_index}: invalid detection geometry/confidence")
    return Detection(
        x1=x1, y1=y1, x2=x2, y2=y2,
        confidence=confidence, label="ball",
    )


def build_ball_detection_cache(
    video,
    model,
    documents,
    rows,
    court_fractions,
    *,
    low_threshold,
    imgsz,
    class_id=COCO_SPORTS_BALL_CLASS_ID,
):
    class_id = normalize_ball_class_id(class_id)
    expected_frames = _expected_sequence_frames(documents)
    if sorted(rows) != sorted(expected_frames):
        raise ValueError("inference rows do not exactly cover the GT sequence frames")
    if sorted(court_fractions) != sorted(expected_frames):
        raise ValueError("court fractions do not exactly cover the GT sequence frames")
    return {
        "schema_version": BALL_CACHE_SCHEMA,
        "source": {
            "video_sha256": sha256_file(video),
            "model_sha256": sha256_file(model),
            "model_name": Path(model).name,
        },
        "detector": {
            "type": "YoloSportsBallDetector",
            "class_id": class_id,
            "low_threshold": float(low_threshold),
            "imgsz": int(imgsz),
        },
        "sequences": _sequence_specs(documents),
        "frames": [
            {
                "frame_index": frame_index,
                "largest_blue_court_fraction": float(court_fractions[frame_index]),
                "detections": [_serialized(item) for item in rows[frame_index]],
            }
            for frame_index in expected_frames
        ],
    }


def load_ball_detection_cache(
    path,
    *,
    video,
    model,
    documents,
    low_threshold,
    imgsz,
    class_id=COCO_SPORTS_BALL_CLASS_ID,
):
    class_id = normalize_ball_class_id(class_id)
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if payload.get("schema_version") != BALL_CACHE_SCHEMA:
        raise ValueError(f"cache schema must be {BALL_CACHE_SCHEMA}")
    expected_source = {
        "video_sha256": sha256_file(video),
        "model_sha256": sha256_file(model),
        "model_name": Path(model).name,
    }
    if payload.get("source") != expected_source:
        raise ValueError("cache source video/model mismatch")
    expected_detector = {
        "type": "YoloSportsBallDetector",
        "class_id": class_id,
        "low_threshold": float(low_threshold),
        "imgsz": int(imgsz),
    }
    if payload.get("detector") != expected_detector:
        raise ValueError("cache detector configuration mismatch")
    if payload.get("sequences") != _sequence_specs(documents):
        raise ValueError("cache GT sequence coverage mismatch")
    frame_payloads = payload.get("frames")
    if not isinstance(frame_payloads, list):
        raise ValueError("cache frames must be a list")
    expected_frames = _expected_sequence_frames(documents)
    indexes = [
        row.get("frame_index") for row in frame_payloads if isinstance(row, dict)
    ]
    if indexes != expected_frames:
        raise ValueError("cache frames are incomplete, duplicated, or out of order")
    rows, fractions = {}, {}
    for row in frame_payloads:
        frame_index = row["frame_index"]
        try:
            fraction = float(row["largest_blue_court_fraction"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"cache frame {frame_index}: invalid court fraction") from exc
        if not 0 <= fraction <= 1:
            raise ValueError(f"cache frame {frame_index}: invalid court fraction")
        detections = row.get("detections")
        if not isinstance(detections, list):
            raise ValueError(f"cache frame {frame_index}: detections must be a list")
        rows[frame_index] = [
            _deserialize_detection(item, frame_index) for item in detections
        ]
        fractions[frame_index] = fraction
    return rows, fractions


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


def evaluate_visible_sequences(documents, prediction_variants):
    """Score every positive sequence independently.

    Negative-only control sequences remain covered by the aggregate evaluator;
    they cannot be passed to ``evaluate_ball_ground_truth`` on their own because
    that deliberately requires at least one human-visible ball box.
    """
    results = {}
    for document in documents:
        annotations = document["annotations"]
        if not any(row["state"] == "visible" for row in annotations):
            continue
        name = document["sequence"]["name"]
        if name in results:
            raise ValueError(f"duplicate visible sequence name: {name}")
        results[name] = {
            variant: evaluate_ball_ground_truth(annotations, predictions)
            for variant, predictions in prediction_variants.items()
        }
    return results


def is_non_regressive(candidate, control):
    return (
        candidate["matched"] >= control["matched"]
        and candidate["false_negatives_on_visible_frames"]
        <= control["false_negatives_on_visible_frames"]
        and candidate["false_positive_candidates_on_evaluable_frames"]
        <= control["false_positive_candidates_on_evaluable_frames"]
        and candidate["longest_consecutive_visible_miss_run"]
        <= control["longest_consecutive_visible_miss_run"]
    )


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
    cache_input=None,
    cache_output=None,
    ball_class_id=COCO_SPORTS_BALL_CLASS_ID,
):
    ball_class_id = normalize_ball_class_id(ball_class_id)
    if not 0 < float(low_threshold) <= float(high_threshold) <= 1:
        raise ValueError("require 0 < low_threshold <= high_threshold <= 1")
    if cache_input is not None and cache_output is not None:
        raise ValueError("cache_input and cache_output are mutually exclusive")
    if cache_output is not None:
        cache_output = Path(cache_output)
        if cache_output.exists():
            raise ValueError(f"Cache output already exists: {cache_output}")
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
    _expected_sequence_frames(documents)

    inference_rows, court_fractions = {}, {}
    if cache_input is not None:
        inference_rows, court_fractions = load_ball_detection_cache(
            cache_input,
            video=video,
            model=model,
            documents=documents,
            low_threshold=low_threshold,
            imgsz=imgsz,
            class_id=ball_class_id,
        )
    else:
        try:
            import cv2
        except ImportError as exc:  # pragma: no cover - optional vision runtime
            raise RuntimeError("OpenCV is required for new inference") from exc
        detector = YoloSportsBallDetector(
            model, confidence=low_threshold, imgsz=imgsz,
            class_id=ball_class_id,
        )
        cap = cv2.VideoCapture(str(video))
        if not cap.isOpened():
            raise RuntimeError(f"Could not open video: {video}")
        try:
            for document in documents:
                sequence = document["sequence"]
                start = sequence["start_frame"]
                end = sequence["end_frame_exclusive"]
                cap.set(cv2.CAP_PROP_POS_FRAMES, start)
                for frame_index in range(start, end):
                    ok, frame = cap.read()
                    if not ok:
                        raise RuntimeError(f"Video ended before frame {frame_index}")
                    inference_rows[frame_index] = detector.detect(frame)
                    court_fractions[frame_index] = blue_court_fraction(frame)
        finally:
            cap.release()
        if cache_output is not None:
            cache_document = build_ball_detection_cache(
                video,
                model,
                documents,
                inference_rows,
                court_fractions,
                low_threshold=low_threshold,
                imgsz=imgsz,
                class_id=ball_class_id,
            )
            cache_output.parent.mkdir(parents=True, exist_ok=True)
            with cache_output.open("x", encoding="utf-8") as stream:
                stream.write(json.dumps(cache_document, indent=2) + "\n")
    control_predictions = {}
    guarded_predictions = {}
    temporal_predictions = {}
    raw_low_predictions = {}
    sensitivity_predictions = {value: {} for value in (3, 4, 5)}
    decisions = []
    for document in documents:
        sequence = document["sequence"]
        start = sequence["start_frame"]
        end = sequence["end_frame_exclusive"]
        raw_rows = {
            frame_index: inference_rows[frame_index]
            for frame_index in range(start, end)
        }
        fractions = {
            frame_index: court_fractions[frame_index]
            for frame_index in range(start, end)
        }
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

    control_metrics = evaluate_ball_ground_truth(annotations, control_predictions)
    guarded_metrics = evaluate_ball_ground_truth(annotations, guarded_predictions)
    temporal_metrics = evaluate_ball_ground_truth(annotations, temporal_predictions)
    sensitivity_metrics = {
        str(value): evaluate_ball_ground_truth(annotations, predictions)
        for value, predictions in sensitivity_predictions.items()
    }
    per_visible_sequence = evaluate_visible_sequences(documents, {
        "raw_strong_control": control_predictions,
        "blue_court_guard": guarded_predictions,
        "blue_court_plus_temporal": temporal_predictions,
        **{
            f"max_missed_{value}": predictions
            for value, predictions in sensitivity_predictions.items()
        },
    })
    aggregate_non_regression = is_non_regressive(temporal_metrics, guarded_metrics)
    per_sequence_non_regression = all(
        is_non_regressive(
            metrics["blue_court_plus_temporal"], metrics["blue_court_guard"],
        )
        for metrics in per_visible_sequence.values()
    )
    verified = aggregate_non_regression and per_sequence_non_regression
    return {
        "status": (
            "TEMPORAL_SELECTION_VERIFIED_ON_REVIEWED_SAMPLE_NOT_MATCH_ACCURACY"
            if verified else
            "TEMPORAL_SELECTION_REJECTED_ON_REVIEWED_SAMPLE"
        ),
        "processing": {
            "detector": (
                "STRICT_DETECTION_CACHE_REPLAY_NO_NEURAL_INFERENCE"
                if cache_input is not None else
                "NEW_NEURAL_INFERENCE_ON_EVERY_FRAME_OF_LISTED_GT_SEQUENCES"
            ),
            "comparisons": "SAME_RUN_PERSISTED_BOX_THRESHOLD_GUARD_AND_TEMPORAL_SELECTION",
            "synthetic_ball_positions": 0,
        },
        "inputs": {
            "video_sha256": sha256_file(video),
            "model_sha256": sha256_file(model),
            "ground_truth_files": [str(path) for path in ground_truth_paths],
            "detection_cache": (
                {
                    "mode": "replay",
                    "sha256": sha256_file(cache_input),
                }
                if cache_input is not None else
                ({
                    "mode": "generated",
                    "sha256": sha256_file(cache_output),
                } if cache_output is not None else None)
            ),
        },
        "settings": {
            "low_threshold": float(low_threshold),
            "high_threshold": float(high_threshold),
            "imgsz": int(imgsz),
            "ball_class_id": int(ball_class_id),
            "max_missed": int(max_missed),
            "min_largest_blue_court_fraction": float(min_court_fraction),
        },
        "requirements": {
            "matched_delta_vs_guard_min": 0,
            "visible_false_negative_delta_vs_guard_max": 0,
            "false_positive_delta_vs_guard_max": 0,
            "longest_visible_miss_run_delta_vs_guard_max": 0,
            "same_non_regression_required_for_each_visible_sequence": True,
        },
        "verification": {
            "aggregate_non_regression": aggregate_non_regression,
            "per_visible_sequence_non_regression": per_sequence_non_regression,
        },
        "raw_strong_control": control_metrics,
        "blue_court_guard": guarded_metrics,
        "blue_court_plus_temporal": temporal_metrics,
        "max_missed_sensitivity": sensitivity_metrics,
        "per_visible_sequence": per_visible_sequence,
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
    parser.add_argument(
        "--ball-class-id", type=int, default=COCO_SPORTS_BALL_CLASS_ID,
        help="Detector class containing the ball (COCO sports ball is 32; single-class models commonly use 0)",
    )
    parser.add_argument("--max-missed", type=int, default=4)
    parser.add_argument("--min-court-fraction", type=float, default=.15)
    cache_group = parser.add_mutually_exclusive_group()
    cache_group.add_argument("--cache-input")
    cache_group.add_argument("--cache-output")
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
        ball_class_id=args.ball_class_id,
        max_missed=args.max_missed,
        min_court_fraction=args.min_court_fraction,
        cache_input=args.cache_input,
        cache_output=args.cache_output,
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

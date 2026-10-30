"""Replay persisted ball boxes through the fixture's blue-court presence guard."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from sevenmetros_ai.ball_ground_truth import (
    evaluate_ball_ground_truth,
    sha256_file,
    validate_ball_ground_truth,
)
from sevenmetros_ai.fixture_filter import blue_court_fraction


def gate_predictions(predictions, court_fractions, *, min_fraction=.15):
    """Return retained boxes plus an auditable per-frame guard decision."""
    threshold = float(min_fraction)
    if not 0 < threshold <= 1:
        raise ValueError("min_fraction must be in (0,1]")
    retained, decisions = {}, []
    for frame in sorted(court_fractions):
        candidates = list(predictions.get(frame, []))
        fraction = float(court_fractions[frame])
        keep = fraction >= threshold
        retained[frame] = candidates if keep else []
        decisions.append({
            "frame_index": int(frame),
            "largest_blue_court_fraction": fraction,
            "court_present": keep,
            "candidates_before": len(candidates),
            "candidates_after": len(retained[frame]),
        })
    return retained, decisions


def benchmark(video, evidence_path, *, min_fraction=.15):
    try:
        import cv2
    except ImportError as exc:  # pragma: no cover - optional vision runtime
        raise RuntimeError("OpenCV is required") from exc
    video, evidence_path = Path(video), Path(evidence_path)
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    if evidence.get("inference") != "NEW_NEURAL_INFERENCE_ON_LISTED_EVALUABLE_FRAMES":
        raise ValueError("source evidence must contain new neural inference")
    if evidence["inputs"]["video_sha256"] != sha256_file(video):
        raise ValueError("source video hash does not match evidence")

    annotations = []
    for path in evidence["inputs"]["ground_truth_files"]:
        document = json.loads(Path(path).read_text(encoding="utf-8"))
        validate_ball_ground_truth(document, source_video=video)
        annotations.extend(document["annotations"])
    evaluable = sorted(
        int(row["frame_index"]) for row in annotations
        if row["state"] in {"visible", "out_of_frame"}
    )
    predictions = {
        int(frame): rows for frame, rows in evidence["predictions"].items()
    }
    if set(predictions) != set(evaluable):
        raise ValueError("source predictions do not cover exactly the evaluable GT frames")

    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {video}")
    fractions = {}
    try:
        for frame in evaluable:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame)
            ok, image = cap.read()
            if not ok:
                raise RuntimeError(f"Video ended before frame {frame}")
            fractions[frame] = blue_court_fraction(image)
    finally:
        cap.release()

    guarded, decisions = gate_predictions(
        predictions, fractions, min_fraction=min_fraction,
    )
    control = evaluate_ball_ground_truth(annotations, predictions)
    candidate = evaluate_ball_ground_truth(annotations, guarded)
    states = {int(row["frame_index"]): row["state"] for row in annotations}
    removed_visible = sum(
        row["candidates_before"] - row["candidates_after"]
        for row in decisions if states[row["frame_index"]] == "visible"
    )
    removed_negative = sum(
        row["candidates_before"] - row["candidates_after"]
        for row in decisions if states[row["frame_index"]] == "out_of_frame"
    )
    verified = (
        removed_visible == 0
        and removed_negative > 0
        and candidate["matched"] == control["matched"]
        and candidate["false_negatives_on_visible_frames"]
        == control["false_negatives_on_visible_frames"]
    )
    return {
        "status": (
            "BALL_SCENE_GUARD_VERIFIED_ON_REVIEWED_SAMPLE_NOT_MATCH_ACCURACY"
            if verified else "BALL_SCENE_GUARD_REJECTED_ON_REVIEWED_SAMPLE"
        ),
        "processing": "REPLAY_OF_PERSISTED_NEURAL_BOXES_PLUS_NEW_BLUE_COURT_MASK",
        "inputs": {
            "video_sha256": sha256_file(video),
            "source_evidence_sha256": sha256_file(evidence_path),
        },
        "settings": {
            "min_largest_blue_court_fraction": float(min_fraction),
            "hsv_lower": [85, 60, 95],
            "hsv_upper": [120, 255, 255],
        },
        "requirements": {
            "visible_candidates_removed": 0,
            "negative_candidates_removed_min": 1,
            "matched_delta_min": 0,
            "visible_false_negative_delta_max": 0,
        },
        "guard_effect": {
            "visible_candidates_removed": removed_visible,
            "negative_candidates_removed": removed_negative,
            "frames_rejected": sum(not row["court_present"] for row in decisions),
        },
        "control": control,
        "guarded": candidate,
        "frames": decisions,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True)
    parser.add_argument("--evidence", required=True)
    parser.add_argument("--min-court-fraction", type=float, default=.15)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output = Path(args.output)
    if output.exists():
        raise ValueError(f"Output already exists: {output}")
    result = benchmark(
        args.video, args.evidence, min_fraction=args.min_court_fraction,
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

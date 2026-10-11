"""Validation contract for sparse human ground truth of a handball.

The contract deliberately distinguishes a visible, localisable ball from frames
where the reviewer cannot draw a defensible box.  Ambiguous or occluded frames
must never be silently converted into negative examples.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import hashlib
from math import hypot
from pathlib import Path


SCHEMA_VERSION = "sevenmetros.ball-gt/v1"
BALL_STATES = frozenset({"visible", "occluded", "out_of_frame", "ambiguous"})


@dataclass(frozen=True)
class BallGroundTruthSummary:
    sequence: str
    total_frames: int
    state_counts: dict[str, int]
    visible_frames: int
    visibility_fraction: float
    evaluable_localisation: bool

    def to_dict(self):
        return {
            "sequence": self.sequence,
            "total_frames": self.total_frames,
            "state_counts": self.state_counts,
            "visible_frames": self.visible_frames,
            "visibility_fraction": self.visibility_fraction,
            "evaluable_localisation": self.evaluable_localisation,
        }


def sha256_file(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def _validate_bbox(bbox, width, height, frame_index):
    if not isinstance(bbox, list) or len(bbox) != 4:
        raise ValueError(f"frame {frame_index}: visible state requires bbox_xyxy[4]")
    try:
        x1, y1, x2, y2 = [float(value) for value in bbox]
    except (TypeError, ValueError) as exc:
        raise ValueError(f"frame {frame_index}: bbox values must be numeric") from exc
    if not (0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height):
        raise ValueError(f"frame {frame_index}: bbox_xyxy is outside {width}x{height}")


def validate_ball_ground_truth(document, *, source_video=None):
    """Validate a ball-GT document and return a conservative coverage summary."""
    if document.get("schema_version") != SCHEMA_VERSION:
        raise ValueError(f"schema_version must be {SCHEMA_VERSION}")
    source = document.get("source", {})
    width, height = source.get("width"), source.get("height")
    if not isinstance(width, int) or width <= 0 or not isinstance(height, int) or height <= 0:
        raise ValueError("source width and height must be positive integers")
    expected_sha = source.get("video_sha256")
    if not isinstance(expected_sha, str) or len(expected_sha) != 64:
        raise ValueError("source video_sha256 must contain 64 hexadecimal characters")
    try:
        int(expected_sha, 16)
    except ValueError as exc:
        raise ValueError("source video_sha256 must contain 64 hexadecimal characters") from exc
    if source_video is not None and sha256_file(source_video) != expected_sha:
        raise ValueError("source video SHA256 does not match the annotation document")

    sequence = document.get("sequence", {})
    name = sequence.get("name")
    start, end = sequence.get("start_frame"), sequence.get("end_frame_exclusive")
    if not isinstance(name, str) or not name:
        raise ValueError("sequence name must be non-empty")
    if not isinstance(start, int) or not isinstance(end, int) or start < 0 or end <= start:
        raise ValueError("sequence frame interval is invalid")

    annotations = document.get("annotations")
    if not isinstance(annotations, list):
        raise ValueError("annotations must be a list")
    frames = [row.get("frame_index") for row in annotations if isinstance(row, dict)]
    expected_frames = list(range(start, end))
    if frames != expected_frames:
        raise ValueError("annotations must contain each sequence frame exactly once and in order")

    counts = Counter()
    for row in annotations:
        frame_index = row["frame_index"]
        state = row.get("state")
        if state not in BALL_STATES:
            raise ValueError(f"frame {frame_index}: invalid state {state!r}")
        bbox = row.get("bbox_xyxy")
        if state == "visible":
            _validate_bbox(bbox, width, height, frame_index)
        elif bbox is not None:
            raise ValueError(f"frame {frame_index}: only visible state may carry bbox_xyxy")
        if state != "visible" and not str(row.get("note", "")).strip():
            raise ValueError(f"frame {frame_index}: non-visible state requires a review note")
        counts[state] += 1

    visible = counts["visible"]
    total = len(annotations)
    return BallGroundTruthSummary(
        sequence=name,
        total_frames=total,
        state_counts={state: counts[state] for state in sorted(BALL_STATES)},
        visible_frames=visible,
        visibility_fraction=visible / total,
        evaluable_localisation=visible > 0,
    )


def bbox_iou(first, second):
    ax1, ay1, ax2, ay2 = map(float, first)
    bx1, by1, bx2, by2 = map(float, second)
    intersection = max(0.0, min(ax2, bx2) - max(ax1, bx1)) * max(
        0.0, min(ay2, by2) - max(ay1, by1)
    )
    union = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - intersection
    return intersection / union if union > 0 else 0.0


def evaluate_ball_ground_truth(annotations, predictions_by_frame, *, iou_threshold=.5):
    """Score visible positives and human-confirmed out-of-frame negatives.

    Ambiguous and occluded rows are ignored rather than treated as detector
    negatives.  ``out_of_frame`` is evaluable because the broadcast image cannot
    contain a true ball box.  The result remains sequence-local agreement, not a
    claim of whole-match detector accuracy.
    """
    if not 0 < float(iou_threshold) <= 1:
        raise ValueError("iou_threshold must be in (0,1]")
    visible = [row for row in annotations if row.get("state") == "visible"]
    negatives = [row for row in annotations if row.get("state") == "out_of_frame"]
    if not visible:
        raise ValueError("no visible human ball boxes are available for evaluation")
    matched = false_negatives = false_positives = 0
    best_ious = []
    center_errors = []
    frames = []
    for row in visible:
        frame = int(row["frame_index"])
        gt = row["bbox_xyxy"]
        candidates = list(predictions_by_frame.get(frame, []))
        ranked = sorted(
            ((bbox_iou(gt, candidate["bbox_xyxy"]), candidate) for candidate in candidates),
            key=lambda item: item[0], reverse=True,
        )
        best_iou = ranked[0][0] if ranked else 0.0
        is_match = best_iou >= iou_threshold
        matched += int(is_match)
        false_negatives += int(not is_match)
        false_positives += len(candidates) - int(is_match)
        if ranked:
            prediction = ranked[0][1]["bbox_xyxy"]
            gcx, gcy = (gt[0] + gt[2]) / 2, (gt[1] + gt[3]) / 2
            pcx, pcy = ((prediction[0] + prediction[2]) / 2,
                        (prediction[1] + prediction[3]) / 2)
            center_errors.append(hypot(gcx - pcx, gcy - pcy))
        best_ious.append(best_iou)
        frames.append({
            "frame_index": frame,
            "gt_state": "visible",
            "candidates": len(candidates),
            "best_iou": best_iou,
            "matched_iou_threshold": is_match,
        })
    positive_false_positives = false_positives
    missed_visible_frames = sorted(
        row["frame_index"] for row in frames
        if row["gt_state"] == "visible" and not row["matched_iou_threshold"]
    )
    visible_miss_runs = []
    for frame in missed_visible_frames:
        if not visible_miss_runs or frame != visible_miss_runs[-1]["end_frame"] + 1:
            visible_miss_runs.append({
                "start_frame": frame,
                "end_frame": frame,
                "length": 1,
            })
        else:
            visible_miss_runs[-1]["end_frame"] = frame
            visible_miss_runs[-1]["length"] += 1
    negative_frames_with_candidates = 0
    for row in negatives:
        frame = int(row["frame_index"])
        candidates = list(predictions_by_frame.get(frame, []))
        negative_frames_with_candidates += int(bool(candidates))
        false_positives += len(candidates)
        frames.append({
            "frame_index": frame,
            "gt_state": "out_of_frame",
            "candidates": len(candidates),
            "best_iou": None,
            "matched_iou_threshold": False,
        })
    positive_precision = (
        matched / (matched + positive_false_positives)
        if matched + positive_false_positives else 0.0
    )
    evaluable_precision = (
        matched / (matched + false_positives) if matched + false_positives else 0.0
    )
    recall = matched / (matched + false_negatives)
    return {
        "status": (
            "REVIEWED_VISIBLE_AND_OUT_OF_FRAME_SAMPLE_NOT_MATCH_ACCURACY"
            if negatives else "VISIBLE_POSITIVE_FRAMES_ONLY_NOT_MATCH_ACCURACY"
        ),
        "iou_threshold": float(iou_threshold),
        "visible_gt_frames": len(visible),
        "out_of_frame_negative_frames": len(negatives),
        "negative_frames_with_candidates": negative_frames_with_candidates,
        "matched": matched,
        "false_negatives_on_visible_frames": false_negatives,
        "visible_miss_runs": visible_miss_runs,
        "longest_consecutive_visible_miss_run": max(
            (run["length"] for run in visible_miss_runs), default=0,
        ),
        "false_positives_on_visible_frames": positive_false_positives,
        "false_positive_candidates_on_evaluable_frames": false_positives,
        "precision_on_reviewed_positive_frames": positive_precision,
        "precision_on_reviewed_evaluable_frames": evaluable_precision,
        "recall_on_reviewed_positive_frames": recall,
        "mean_best_iou": sum(best_ious) / len(best_ious),
        "mean_center_error_px": (
            sum(center_errors) / len(center_errors) if center_errors else None
        ),
        "frames": sorted(frames, key=lambda item: item["frame_index"]),
    }


def evaluate_visible_ball_frames(annotations, predictions_by_frame, *, iou_threshold=.5):
    """Backward-compatible alias for the ball-GT evaluator."""
    return evaluate_ball_ground_truth(
        annotations, predictions_by_frame, iou_threshold=iou_threshold,
    )

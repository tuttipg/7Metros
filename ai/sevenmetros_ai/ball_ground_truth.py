"""Validation contract for sparse human ground truth of a handball.

The contract deliberately distinguishes a visible, localisable ball from frames
where the reviewer cannot draw a defensible box.  Ambiguous or occluded frames
must never be silently converted into negative examples.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import hashlib
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

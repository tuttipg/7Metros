"""Validation and scoring for small human-reviewed possession/event GT.

The module is intentionally semantic-only: it never creates or fills labels.
Human-reviewed GT is supplied as JSON and model output is supplied separately.
"""
from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Iterable

SCHEMA = "sevenmetros.semantic-gt/v1"
VALID_BALL_STATES = {"visible", "out_of_frame", "occluded", "ambiguous"}
VALID_POSSESSION_STATES = {"controlled", "free", "unassigned", "ambiguous", "unknown"}
VALID_EVENT_KINDS = {"none", "same_team_control_change", "opponent_control_change"}


@dataclass(frozen=True)
class SemanticGt:
    video_sha256: str
    start_frame: int
    end_frame_exclusive: int
    frames: tuple[dict, ...]
    events: tuple[dict, ...]
    status: str


def _integer(value, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{name} must be an integer")
    return value


def validate_semantic_gt(document: dict) -> SemanticGt:
    if not isinstance(document, dict):
        raise ValueError("semantic GT must be an object")
    if document.get("schema_version") != SCHEMA:
        raise ValueError(f"schema_version must be {SCHEMA}")
    source = document.get("source")
    sequence = document.get("sequence")
    frames = document.get("frames")
    events = document.get("events")
    if not isinstance(source, dict) or not isinstance(source.get("video_sha256"), str) or len(source["video_sha256"]) != 64:
        raise ValueError("source.video_sha256 must be a SHA-256 hex string")
    start = _integer(sequence.get("start_frame"), "sequence.start_frame") if isinstance(sequence, dict) else None
    end = _integer(sequence.get("end_frame_exclusive"), "sequence.end_frame_exclusive") if isinstance(sequence, dict) else None
    if start is None or end is None or end <= start:
        raise ValueError("invalid sequence range")
    if not isinstance(frames, list) or len(frames) != end - start:
        raise ValueError("frames must cover the sequence exactly once")
    expected = list(range(start, end))
    got = []
    clean = []
    for row in frames:
        if not isinstance(row, dict):
            raise ValueError("each frame row must be an object")
        frame = _integer(row.get("frame_index"), "frame_index")
        got.append(frame)
        ball_state = row.get("ball_state")
        possession_state = row.get("possession_state")
        if ball_state not in VALID_BALL_STATES:
            raise ValueError(f"frame {frame}: invalid ball_state")
        if possession_state not in VALID_POSSESSION_STATES:
            raise ValueError(f"frame {frame}: invalid possession_state")
        if ball_state == "out_of_frame" and possession_state != "unknown":
            raise ValueError(f"frame {frame}: out_of_frame ball requires unknown possession")
        if possession_state in {"controlled", "free"} and ball_state != "visible":
            raise ValueError(f"frame {frame}: controlled/free possession requires visible ball")
        if ball_state in {"occluded", "ambiguous"} and possession_state == "controlled":
            raise ValueError(f"frame {frame}: controlled possession cannot be certain when ball is {ball_state}")
        possessor = row.get("possessor_ref")
        if possession_state == "controlled":
            if not isinstance(possessor, str) or not possessor:
                raise ValueError(f"frame {frame}: controlled possession requires possessor_ref")
        elif possessor is not None:
            raise ValueError(f"frame {frame}: non-controlled possession cannot have possessor_ref")
        clean.append({"frame_index": frame, "ball_state": ball_state, "possession_state": possession_state, "possessor_ref": possessor})
    if got != expected:
        raise ValueError("frame_index values must be contiguous and ordered")
    if not isinstance(events, list):
        raise ValueError("events must be a list")
    clean_events = []
    for event in events:
        if not isinstance(event, dict):
            raise ValueError("event must be an object")
        kind = event.get("kind")
        frame = _integer(event.get("frame_index"), "event.frame_index")
        if kind not in VALID_EVENT_KINDS or kind == "none":
            raise ValueError("events must contain a real control-change kind")
        if not start <= frame < end:
            raise ValueError("event frame must be inside the sequence")
        clean_events.append(dict(event))
    return SemanticGt(
        video_sha256=source["video_sha256"],
        start_frame=start,
        end_frame_exclusive=end,
        frames=tuple(clean),
        events=tuple(clean_events),
        status=str(document.get("status", "")),
    )


def load_semantic_gt(path: str | Path) -> SemanticGt:
    return validate_semantic_gt(json.loads(Path(path).read_text(encoding="utf-8")))


def score_possession(gt: SemanticGt, predictions: Iterable[dict]) -> dict:
    pred_by_frame = {int(row["frame_index"]): row for row in predictions}
    rows = []
    for frame in gt.frames:
        pred = pred_by_frame.get(frame["frame_index"], {"possession_state": "unknown", "possessor_ref": None})
        gt_controlled = frame["possession_state"] == "controlled"
        pred_controlled = pred.get("possession_state") == "controlled"
        rows.append((gt_controlled, pred_controlled, frame.get("possessor_ref"), pred.get("possessor_ref")))
    tp = sum(a and b for a, b, _, _ in rows)
    fp = sum((not a) and b for a, b, _, _ in rows)
    fn = sum(a and (not b) for a, b, _, _ in rows)
    identity_correct = sum(a and b and gt_id == pred_id for a, b, gt_id, pred_id in rows)
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    f1 = 2 * precision * recall / (precision + recall) if precision is not None and recall is not None and precision + recall else None
    return {
        "frames": len(rows),
        "gt_controlled_frames": sum(a for a, _, _, _ in rows),
        "pred_controlled_frames": sum(b for _, b, _, _ in rows),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "controlled_identity_correct": identity_correct,
        "controlled_identity_accuracy": identity_correct / tp if tp else None,
    }


def score_events(gt: SemanticGt, predicted_events: Iterable[dict], *, tolerance_frames: int = 2) -> dict:
    if isinstance(tolerance_frames, bool) or not isinstance(tolerance_frames, int) or tolerance_frames < 0:
        raise ValueError("tolerance_frames must be a non-negative integer")
    candidates = [dict(x) for x in predicted_events]
    unmatched = set(range(len(candidates)))
    matches = []
    for event in sorted(gt.events, key=lambda x: x["frame_index"]):
        eligible = [
            i for i in unmatched
            if candidates[i].get("kind") == event["kind"]
            and abs(int(candidates[i]["frame_index"]) - event["frame_index"]) <= tolerance_frames
        ]
        if not eligible:
            continue
        i = min(eligible, key=lambda j: abs(int(candidates[j]["frame_index"]) - event["frame_index"]))
        unmatched.remove(i)
        matches.append({
            "gt_frame": event["frame_index"],
            "pred_frame": int(candidates[i]["frame_index"]),
            "kind": event["kind"],
        })
    tp = len(matches)
    fp = len(unmatched)
    fn = len(gt.events) - tp
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    return {
        "gt_events": len(gt.events),
        "predicted_events": len(candidates),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": precision,
        "recall": recall,
        "matches": matches,
        "tolerance_frames": tolerance_frames,
    }

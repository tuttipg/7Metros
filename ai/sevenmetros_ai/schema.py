from __future__ import annotations

from typing import Iterable

from .tracking import Track


SCHEMA_VERSION = "7metros-ai.v1"


def frame_payload(*, frame_index: int, timestamp_ms: float, width: int, height: int, tracks: Iterable[Track]) -> dict:
    objects = []
    for track in tracks:
        det = track.detection
        objects.append({
            "track_id": track.track_id,
            "kind": det.label,
            "confidence": round(float(det.confidence), 6),
            "bbox_xyxy": [round(float(det.x1), 3), round(float(det.y1), 3), round(float(det.x2), 3), round(float(det.y2), 3)],
            "center_xy": [round(det.cx, 3), round(det.cy, 3)],
            "team": det.team,
        })
    return {
        "schema": SCHEMA_VERSION,
        "frame_index": int(frame_index),
        "timestamp_ms": round(float(timestamp_ms), 3),
        "image": {"width": int(width), "height": int(height)},
        "objects": objects,
    }

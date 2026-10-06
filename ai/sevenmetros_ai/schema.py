from __future__ import annotations

from typing import Iterable

from .tracking import Track


SCHEMA_VERSION = "7metros-ai.v1"


def clipped_bbox(detection, width, height):
    """Clip a detection to the image, or return ``None`` if it is invisible."""
    x1 = min(max(float(detection.x1), 0.0), float(width))
    y1 = min(max(float(detection.y1), 0.0), float(height))
    x2 = min(max(float(detection.x2), 0.0), float(width))
    y2 = min(max(float(detection.y2), 0.0), float(height))
    if x1 >= x2 or y1 >= y2:
        return None
    return x1, y1, x2, y2


def frame_payload(*, frame_index: int, timestamp_ms: float, width: int, height: int, tracks: Iterable[Track]) -> dict:
    objects = []
    for track in tracks:
        det = track.detection
        box = clipped_bbox(det, width, height)
        if box is None:
            continue
        x1, y1, x2, y2 = box
        objects.append({
            "track_id": track.track_id,
            "kind": det.label,
            "confidence": round(float(det.confidence), 6),
            "bbox_xyxy": [round(x1, 3), round(y1, 3), round(x2, 3), round(y2, 3)],
            "center_xy": [round((x1 + x2) / 2, 3), round((y1 + y2) / 2, 3)],
            "velocity_xy": [round(track.velocity_x, 3), round(track.velocity_y, 3)],
            "team": det.team,
        })
        if det.role_candidate is not None:
            objects[-1]['role_candidate'] = det.role_candidate
    return {
        "schema": SCHEMA_VERSION,
        "frame_index": int(frame_index),
        "timestamp_ms": round(float(timestamp_ms), 3),
        "image": {"width": int(width), "height": int(height)},
        "objects": objects,
    }

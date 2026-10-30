from __future__ import annotations

from copy import deepcopy
from typing import Iterable


def _box_center(box):
    x1, y1, x2, y2 = (float(value) for value in box)
    return (x1 + x2) / 2.0, (y1 + y2) / 2.0


def _rounded(values):
    return [round(float(value), 3) for value in values]


def _validated_rows(rows: Iterable[dict]) -> list[dict]:
    """Return a deep copy after validating the minimum tracking contract."""
    copied = [deepcopy(row) for row in rows]
    previous_frame = None
    dimensions = None

    for row in copied:
        if row.get("schema") != "7metros-ai.v1":
            raise ValueError("Unsupported or missing tracking schema")
        frame = row.get("frame_index")
        if not isinstance(frame, int):
            raise ValueError("frame_index must be an integer")
        if previous_frame is not None and frame != previous_frame + 1:
            raise ValueError("Tracking rows must contain contiguous, ordered frames")
        previous_frame = frame

        image = row.get("image") or {}
        width, height = image.get("width"), image.get("height")
        if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
            raise ValueError("Invalid image dimensions")
        if dimensions is None:
            dimensions = (width, height)
        elif dimensions != (width, height):
            raise ValueError("Image dimensions changed inside one tracking stream")

        objects = row.get("objects")
        if not isinstance(objects, list):
            raise ValueError("objects must be a list")
        seen_ids = set()
        for obj in objects:
            track_id = obj.get("track_id")
            if not isinstance(track_id, int) or track_id <= 0:
                raise ValueError("track_id must be a positive integer")
            if track_id in seen_ids:
                raise ValueError(f"Duplicate track_id {track_id} in frame {frame}")
            seen_ids.add(track_id)

            box = obj.get("bbox_xyxy")
            if not isinstance(box, list) or len(box) != 4:
                raise ValueError("bbox_xyxy must contain four values")
            x1, y1, x2, y2 = (float(value) for value in box)
            if not (0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height):
                raise ValueError(f"Invalid bbox for track {track_id} in frame {frame}")

    return copied


def interpolate_short_internal_gaps(rows: Iterable[dict], *, max_missing_frames: int = 5):
    """Linearly fill short internal gaps without creating or extrapolating IDs.

    Only consecutive observations of the same ``track_id`` are considered. A
    gap is filled when it contains at most ``max_missing_frames`` missing frames
    and both endpoint observations have the same ``kind``. Synthetic boxes are
    marked explicitly and use the lower endpoint confidence.

    The function never fills before the first or after the last observation of
    an ID, and never changes an observed box.
    """
    if not isinstance(max_missing_frames, int) or max_missing_frames <= 0:
        raise ValueError("max_missing_frames must be a positive integer")

    output = _validated_rows(rows)
    if not output:
        return output, {
            "max_missing_frames": max_missing_frames,
            "filled_gaps": 0,
            "interpolated_observations": 0,
            "track_ids_affected": [],
        }

    observations: dict[int, list[tuple[int, dict]]] = {}
    for row_index, row in enumerate(output):
        for obj in row["objects"]:
            observations.setdefault(obj["track_id"], []).append((row_index, obj))

    pending: dict[int, list[dict]] = {}
    filled_gaps = 0
    interpolated_observations = 0
    affected = set()

    for track_id, track_observations in observations.items():
        for (left_index, left), (right_index, right) in zip(
            track_observations, track_observations[1:]
        ):
            missing = right_index - left_index - 1
            if missing <= 0 or missing > max_missing_frames:
                continue
            if left.get("kind") != right.get("kind"):
                continue

            left_box = [float(value) for value in left["bbox_xyxy"]]
            right_box = [float(value) for value in right["bbox_xyxy"]]
            left_center = _box_center(left_box)
            right_center = _box_center(right_box)
            frame_delta = missing + 1
            velocity = [
                (right_center[0] - left_center[0]) / frame_delta,
                (right_center[1] - left_center[1]) / frame_delta,
            ]
            confidence = min(float(left.get("confidence", 0.0)), float(right.get("confidence", 0.0)))
            team = left.get("team") if left.get("team") == right.get("team") else None

            for step in range(1, missing + 1):
                alpha = step / frame_delta
                box = [
                    start + (end - start) * alpha
                    for start, end in zip(left_box, right_box)
                ]
                center = _box_center(box)
                synthetic = {
                    "track_id": track_id,
                    "kind": left.get("kind"),
                    "confidence": round(confidence, 6),
                    "bbox_xyxy": _rounded(box),
                    "center_xy": _rounded(center),
                    "velocity_xy": _rounded(velocity),
                    "team": team,
                    "interpolated": True,
                    "interpolation_gap_frames": missing,
                }
                pending.setdefault(left_index + step, []).append(synthetic)
                interpolated_observations += 1

            filled_gaps += 1
            affected.add(track_id)

    for row_index, additions in pending.items():
        additions.sort(key=lambda obj: obj["track_id"])
        output[row_index]["objects"].extend(additions)

    return output, {
        "max_missing_frames": max_missing_frames,
        "filled_gaps": filled_gaps,
        "interpolated_observations": interpolated_observations,
        "track_ids_affected": sorted(affected),
    }

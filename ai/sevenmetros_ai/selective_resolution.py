"""Geometry-only trigger for selective high-resolution person detection.

The trigger is deliberately independent of annotations and track identities.  A
frame is considered suspicious when one of its deduplicated boxes substantially
covers two distinct boxes in an adjacent frame.  This is an offline heuristic:
using the following frame introduces one frame of look-ahead.
"""
from __future__ import annotations

from itertools import combinations

from .fixture_filter import suppress_duplicates
from .tracking import Detection, bbox_iou


def _area(detection: Detection) -> float:
    return max(0.0, detection.x2 - detection.x1) * max(
        0.0, detection.y2 - detection.y1,
    )


def _intersection(a: Detection, b: Detection) -> float:
    width = max(0.0, min(a.x2, b.x2) - max(a.x1, b.x1))
    height = max(0.0, min(a.y2, b.y2) - max(a.y1, b.y1))
    return width * height


def merged_box_frames(
    detections_by_frame: dict[int, list[Detection]],
    *,
    coverage: float = .50,
    pair_iou: float = .20,
    min_aspect: float = .35,
) -> set[int]:
    """Return frames whose boxes resemble a temporal two-person merge.

    A current box must cover at least ``coverage`` of each of two smaller boxes
    in frame t-1 or t+1.  The neighbor pair must have IoU below ``pair_iou`` so
    ordinary duplicate predictions do not activate the trigger.
    """
    if not 0 < coverage <= 1:
        raise ValueError('coverage must be in (0,1]')
    if not 0 <= pair_iou <= 1:
        raise ValueError('pair_iou must be in [0,1]')
    if min_aspect <= 0:
        raise ValueError('min_aspect must be > 0')

    deduplicated = {
        frame: suppress_duplicates(detections)
        for frame, detections in detections_by_frame.items()
    }
    selected = set()
    for frame, current_detections in deduplicated.items():
        for neighbor_frame in (frame - 1, frame + 1):
            if neighbor_frame not in deduplicated:
                continue
            for current in current_detections:
                width = current.x2 - current.x1
                height = current.y2 - current.y1
                current_area = _area(current)
                if height <= 0 or width / height < min_aspect:
                    continue
                covered = [
                    neighbor for neighbor in deduplicated[neighbor_frame]
                    if 0 < _area(neighbor) <= current_area
                    and _intersection(current, neighbor) / _area(neighbor) >= coverage
                ]
                if any(
                    bbox_iou(first, second) < pair_iou
                    for first, second in combinations(covered, 2)
                ):
                    selected.add(frame)
                    break
            if frame in selected:
                break
    return selected


def select_resolution(
    baseline: dict[int, list[Detection]],
    candidate: dict[int, list[Detection]],
    selected_frames: set[int],
) -> dict[int, list[Detection]]:
    """Substitute candidate detections only on selected baseline frames."""
    if set(baseline) != set(candidate):
        raise ValueError('Baseline and candidate caches must contain identical frames')
    unknown = selected_frames - set(baseline)
    if unknown:
        raise ValueError(f'Selected frames are absent from caches: {sorted(unknown)}')
    return {
        frame: candidate[frame] if frame in selected_frames else detections
        for frame, detections in baseline.items()
    }

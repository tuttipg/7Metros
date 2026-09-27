"""Geometry-only trigger for selective high-resolution person detection.

The trigger is deliberately independent of annotations and track identities.  A
frame is considered suspicious when one of its deduplicated boxes substantially
covers two distinct boxes in an adjacent frame.  This is an offline heuristic:
using the following frame introduces one frame of look-ahead.
"""
from __future__ import annotations

from itertools import combinations
from math import hypot

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


def contact_regions(
    detections: list[Detection],
    tracks,
    *,
    max_track_missed: int = 6,
    min_separation_ratio: float = .20,
) -> list[Detection]:
    """Find boxes containing two sufficiently separated predicted track centers."""
    if max_track_missed < 0:
        raise ValueError('max_track_missed must be >= 0')
    if not 0 < min_separation_ratio <= 1:
        raise ValueError('min_separation_ratio must be in (0,1]')
    tracks = list(tracks)
    result = []
    for detection in detections:
        diagonal = hypot(
            detection.x2 - detection.x1,
            detection.y2 - detection.y1,
        )
        if diagonal <= 0:
            continue
        centers = [
            (track.predicted_cx, track.predicted_cy)
            for track in tracks
            if track.missed <= max_track_missed
            and detection.x1 <= track.predicted_cx <= detection.x2
            and detection.y1 <= track.predicted_cy <= detection.y2
        ]
        if any(
            hypot(first[0] - second[0], first[1] - second[1])
            >= min_separation_ratio * diagonal
            for first, second in combinations(centers, 2)
        ):
            result.append(detection)
    return result


def fuse_resolution_regions(
    baseline: list[Detection],
    candidate: list[Detection],
    regions: list[Detection],
    *,
    removal_coverage: float = .50,
    candidate_coverage: float = .20,
    min_candidate_confidence: float = .10,
) -> list[Detection]:
    """Keep baseline boxes outside contact regions and replace only local boxes."""
    detections, _ = fuse_resolution_regions_with_spawn_mask(
        baseline,
        candidate,
        regions,
        removal_coverage=removal_coverage,
        candidate_coverage=candidate_coverage,
        min_candidate_confidence=min_candidate_confidence,
    )
    return detections


def fuse_resolution_regions_with_spawn_mask(
    baseline: list[Detection],
    candidate: list[Detection],
    regions: list[Detection],
    *,
    removal_coverage: float = .50,
    candidate_coverage: float = .20,
    min_candidate_confidence: float = .10,
) -> tuple[list[Detection], list[bool]]:
    """Return local fusion plus a mask that forbids replacements spawning IDs."""
    for name, value in (
        ('removal_coverage', removal_coverage),
        ('candidate_coverage', candidate_coverage),
    ):
        if not 0 < value <= 1:
            raise ValueError(f'{name} must be in (0,1]')
    if not 0 <= min_candidate_confidence <= 1:
        raise ValueError('min_candidate_confidence must be in [0,1]')
    if not regions:
        return list(baseline), [True] * len(baseline)

    def covered(detection, threshold):
        detection_area = _area(detection)
        return detection_area > 0 and any(
            _intersection(detection, region) / detection_area >= threshold
            for region in regions
        )

    kept = [
        detection for detection in baseline
        if not covered(detection, removal_coverage)
    ]
    replacements = [
        detection for detection in candidate
        if detection.confidence >= min_candidate_confidence
        and covered(detection, candidate_coverage)
    ]
    return kept + replacements, [True] * len(kept) + [False] * len(replacements)

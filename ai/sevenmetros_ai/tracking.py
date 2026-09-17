from __future__ import annotations

from dataclasses import dataclass
from math import hypot
from typing import Iterable, Optional


@dataclass(frozen=True)
class Detection:
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float = 1.0
    label: str = "player"
    team: Optional[str] = None

    @property
    def cx(self) -> float:
        return (self.x1 + self.x2) / 2.0

    @property
    def cy(self) -> float:
        return (self.y1 + self.y2) / 2.0


@dataclass
class Track:
    track_id: int
    detection: Detection
    age: int = 1
    missed: int = 0
    velocity_x: float = 0.0
    velocity_y: float = 0.0

    @property
    def predicted_cx(self) -> float:
        return self.detection.cx + self.velocity_x * (self.missed + 1)

    @property
    def predicted_cy(self) -> float:
        return self.detection.cy + self.velocity_y * (self.missed + 1)


def bbox_iou(a: Detection, b: Detection) -> float:
    """Return intersection-over-union for two axis-aligned detections."""
    ix1 = max(a.x1, b.x1)
    iy1 = max(a.y1, b.y1)
    ix2 = min(a.x2, b.x2)
    iy2 = min(a.y2, b.y2)
    iw = max(0.0, ix2 - ix1)
    ih = max(0.0, iy2 - iy1)
    intersection = iw * ih
    if intersection <= 0.0:
        return 0.0
    area_a = max(0.0, a.x2 - a.x1) * max(0.0, a.y2 - a.y1)
    area_b = max(0.0, b.x2 - b.x1) * max(0.0, b.y2 - b.y1)
    union = area_a + area_b - intersection
    return intersection / union if union > 0.0 else 0.0


def _compatible(track: Track, detection: Detection) -> bool:
    """Reject associations that contradict known semantic information.

    Unknown team values remain matchable. Once both sides know a team, a
    red/blue (or local/visitor) mismatch is treated as impossible. Labels are
    always required to match so future ball/goalkeeper detections cannot steal
    player tracks.
    """
    if track.detection.label != detection.label:
        return False
    old_team = track.detection.team
    new_team = detection.team
    return old_team is None or new_team is None or old_team == new_team


class CentroidTracker:
    """Small deterministic motion-aware baseline tracker.

    Matching combines constant-velocity centroid prediction with an IoU bonus
    and semantic gating for label/team consistency. It remains intentionally
    dependency-free and is not intended to replace ByteTrack/BoT-SORT; it
    provides a stable, testable fallback while stronger trackers are integrated.
    """

    def __init__(
        self,
        max_distance: float = 80.0,
        max_missed: int = 8,
        iou_weight: float = 0.25,
    ) -> None:
        if max_distance <= 0:
            raise ValueError("max_distance must be > 0")
        if max_missed < 0:
            raise ValueError("max_missed must be >= 0")
        if not 0.0 <= iou_weight <= 1.0:
            raise ValueError("iou_weight must be between 0 and 1")
        self.max_distance = float(max_distance)
        self.max_missed = int(max_missed)
        self.iou_weight = float(iou_weight)
        self._next_id = 1
        self._tracks: dict[int, Track] = {}

    def update(self, detections: Iterable[Detection]) -> list[Track]:
        detections = list(detections)

        unmatched_track_ids = set(self._tracks)
        unmatched_detection_indexes = set(range(len(detections)))
        candidates: list[tuple[float, int, int]] = []

        for track_id, track in self._tracks.items():
            for idx, detection in enumerate(detections):
                if not _compatible(track, detection):
                    continue
                distance = hypot(
                    track.predicted_cx - detection.cx,
                    track.predicted_cy - detection.cy,
                )
                if distance <= self.max_distance:
                    # Lower is better. IoU only breaks/softens ambiguous spatial
                    # matches; the distance gate remains the hard safety bound.
                    cost = distance - (
                        bbox_iou(track.detection, detection)
                        * self.max_distance
                        * self.iou_weight
                    )
                    candidates.append((cost, track_id, idx))

        for _, track_id, idx in sorted(candidates):
            if track_id not in unmatched_track_ids or idx not in unmatched_detection_indexes:
                continue
            track = self._tracks[track_id]
            previous_cx = track.detection.cx
            previous_cy = track.detection.cy
            track.detection = detections[idx]
            track.velocity_x = track.detection.cx - previous_cx
            track.velocity_y = track.detection.cy - previous_cy
            track.age += 1
            track.missed = 0
            unmatched_track_ids.remove(track_id)
            unmatched_detection_indexes.remove(idx)

        for track_id in list(unmatched_track_ids):
            track = self._tracks[track_id]
            track.missed += 1
            if track.missed > self.max_missed:
                del self._tracks[track_id]

        for idx in sorted(unmatched_detection_indexes):
            self._tracks[self._next_id] = Track(
                track_id=self._next_id,
                detection=detections[idx],
            )
            self._next_id += 1

        return [
            Track(
                track_id=t.track_id,
                detection=t.detection,
                age=t.age,
                missed=t.missed,
                velocity_x=t.velocity_x,
                velocity_y=t.velocity_y,
            )
            for t in sorted(self._tracks.values(), key=lambda item: item.track_id)
            if t.missed == 0
        ]

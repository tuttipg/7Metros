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


class CentroidTracker:
    """Small deterministic motion-aware baseline tracker.

    Matching uses a constant-velocity prediction learned from the previous
    observation. It remains intentionally dependency-free and is not intended
    to replace ByteTrack/BoT-SORT; it provides a stable, testable fallback
    while stronger trackers are integrated.
    """

    def __init__(self, max_distance: float = 80.0, max_missed: int = 8) -> None:
        if max_distance <= 0:
            raise ValueError("max_distance must be > 0")
        if max_missed < 0:
            raise ValueError("max_missed must be >= 0")
        self.max_distance = float(max_distance)
        self.max_missed = int(max_missed)
        self._next_id = 1
        self._tracks: dict[int, Track] = {}

    def update(self, detections: Iterable[Detection]) -> list[Track]:
        detections = list(detections)

        unmatched_track_ids = set(self._tracks)
        unmatched_detection_indexes = set(range(len(detections)))
        candidates: list[tuple[float, int, int]] = []

        for track_id, track in self._tracks.items():
            for idx, detection in enumerate(detections):
                distance = hypot(
                    track.predicted_cx - detection.cx,
                    track.predicted_cy - detection.cy,
                )
                if distance <= self.max_distance:
                    candidates.append((distance, track_id, idx))

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

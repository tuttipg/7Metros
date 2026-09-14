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


class CentroidTracker:
    """Small deterministic baseline tracker.

    It is intentionally dependency-free. It is not intended to replace
    ByteTrack/BoT-SORT; it provides a stable 7Metros output contract and a
    testable fallback while stronger trackers are integrated.
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
                    track.detection.cx - detection.cx,
                    track.detection.cy - detection.cy,
                )
                if distance <= self.max_distance:
                    candidates.append((distance, track_id, idx))

        for _, track_id, idx in sorted(candidates):
            if track_id not in unmatched_track_ids or idx not in unmatched_detection_indexes:
                continue
            track = self._tracks[track_id]
            track.detection = detections[idx]
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
            )
            for t in sorted(self._tracks.values(), key=lambda item: item.track_id)
            if t.missed == 0
        ]

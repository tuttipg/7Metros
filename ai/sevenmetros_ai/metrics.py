from __future__ import annotations

from collections import defaultdict
from statistics import mean, median
from typing import Iterable


class TrackingMetrics:
    """Collect tracker-health metrics without claiming identity accuracy."""

    def __init__(self) -> None:
        self._frames_observed = 0
        self._observations_by_track: dict[int, int] = defaultdict(int)
        self._first_frame_by_track: dict[int, int] = {}
        self._last_frame_by_track: dict[int, int] = {}

    def observe(self, frame_index: int, tracks: Iterable[object]) -> None:
        self._frames_observed = max(self._frames_observed, int(frame_index) + 1)
        for track in tracks:
            track_id = int(getattr(track, "track_id"))
            self._observations_by_track[track_id] += 1
            self._first_frame_by_track.setdefault(track_id, int(frame_index))
            self._last_frame_by_track[track_id] = int(frame_index)

    def summary(self) -> dict:
        unique_tracks = len(self._observations_by_track)
        observations = list(self._observations_by_track.values())
        single_frame_tracks = sum(1 for count in observations if count == 1)
        spans = [
            self._last_frame_by_track[track_id] - self._first_frame_by_track[track_id] + 1
            for track_id in self._observations_by_track
        ]
        return {
            "frames_observed": self._frames_observed,
            "track_observations": sum(observations),
            "unique_tracks": unique_tracks,
            "mean_observations_per_track": round(mean(observations), 3) if observations else 0.0,
            "median_observations_per_track": round(float(median(observations)), 3) if observations else 0.0,
            "max_observations_per_track": max(observations, default=0),
            "mean_track_span_frames": round(mean(spans), 3) if spans else 0.0,
            "single_frame_tracks": single_frame_tracks,
            "single_frame_track_ratio": round(single_frame_tracks / unique_tracks, 6) if unique_tracks else 0.0,
            "new_track_rate_per_100_frames": round(unique_tracks * 100.0 / self._frames_observed, 3) if self._frames_observed else 0.0,
        }

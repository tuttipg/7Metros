"""Conservative temporal association for observed handball candidates.

The tracker never fabricates ball positions.  It only selects among detector
observations already present in the current frame.  Low-confidence detections may
continue an existing segment, but only a high-confidence observation can start a
new segment after a gap.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import hypot, isfinite

from .tracking import Detection


@dataclass(frozen=True)
class BallObservation:
    """One detector-backed ball observation selected by temporal association."""

    detection: Detection
    segment_id: int
    stage: str
    frame_index: int
    gap_from_previous: int | None


class BallObservationTracker:
    """Associate sparse sports-ball detections without interpolating missing frames."""

    def __init__(
        self,
        *,
        low_threshold: float = .02,
        high_threshold: float = .10,
        max_missed: int = 3,
        max_speed_px_per_frame: float = 70.0,
        max_size_ratio: float = 3.0,
        velocity_alpha: float = .4,
    ) -> None:
        low = float(low_threshold)
        high = float(high_threshold)
        speed = float(max_speed_px_per_frame)
        size_ratio = float(max_size_ratio)
        alpha = float(velocity_alpha)
        if not (0 < low <= high <= 1):
            raise ValueError("Require 0 < low_threshold <= high_threshold <= 1")
        if isinstance(max_missed, bool) or int(max_missed) != max_missed or max_missed < 0:
            raise ValueError("max_missed must be a non-negative integer")
        if not isfinite(speed) or speed <= 0:
            raise ValueError("max_speed_px_per_frame must be positive and finite")
        if not isfinite(size_ratio) or size_ratio < 1:
            raise ValueError("max_size_ratio must be finite and >= 1")
        if not isfinite(alpha) or not 0 < alpha <= 1:
            raise ValueError("velocity_alpha must be in (0,1]")
        self.low_threshold = low
        self.high_threshold = high
        self.max_missed = int(max_missed)
        self.max_speed_px_per_frame = speed
        self.max_size_ratio = size_ratio
        self.velocity_alpha = alpha
        self.reset()

    def reset(self) -> None:
        self._active = False
        self._segment_id = 0
        self._last_update_frame: int | None = None
        self._last_observed_frame: int | None = None
        self._last_detection: Detection | None = None
        self._velocity_x = 0.0
        self._velocity_y = 0.0

    @property
    def active(self) -> bool:
        return self._active

    @property
    def segment_id(self) -> int:
        return self._segment_id

    @staticmethod
    def _valid_detection(detection: Detection) -> bool:
        values = (detection.x1, detection.y1, detection.x2, detection.y2, detection.confidence)
        return (
            detection.label == "ball"
            and all(isfinite(float(value)) for value in values)
            and detection.x2 > detection.x1
            and detection.y2 > detection.y1
        )

    @staticmethod
    def _size_ratio(a: Detection, b: Detection) -> float:
        aw, ah = a.x2 - a.x1, a.y2 - a.y1
        bw, bh = b.x2 - b.x1, b.y2 - b.y1
        if min(aw, ah, bw, bh) <= 0:
            return float("inf")
        return max(aw / bw, bw / aw, ah / bh, bh / ah)

    def _strongest(self, detections: list[Detection]) -> Detection | None:
        strong = [d for d in detections if d.confidence >= self.high_threshold]
        return max(strong, key=lambda d: d.confidence, default=None)

    def _spawn(self, frame_index: int, detection: Detection) -> BallObservation:
        self._active = True
        self._segment_id += 1
        self._last_observed_frame = frame_index
        self._last_detection = detection
        self._velocity_x = 0.0
        self._velocity_y = 0.0
        return BallObservation(detection, self._segment_id, "strong", frame_index, None)

    def update(self, frame_index: int, detections) -> BallObservation | None:
        if isinstance(frame_index, bool) or int(frame_index) != frame_index or frame_index < 0:
            raise ValueError("frame_index must be a non-negative integer")
        frame_index = int(frame_index)
        if self._last_update_frame is not None and frame_index <= self._last_update_frame:
            raise ValueError("frame_index must increase strictly")
        self._last_update_frame = frame_index
        candidates = [
            detection for detection in detections
            if self._valid_detection(detection) and detection.confidence >= self.low_threshold
        ]
        if not self._active or self._last_detection is None or self._last_observed_frame is None:
            strongest = self._strongest(candidates)
            return self._spawn(frame_index, strongest) if strongest is not None else None
        gap = frame_index - self._last_observed_frame
        if gap > self.max_missed + 1:
            self._active = False
            strongest = self._strongest(candidates)
            return self._spawn(frame_index, strongest) if strongest is not None else None
        predicted_x = self._last_detection.cx + self._velocity_x * gap
        predicted_y = self._last_detection.cy + self._velocity_y * gap
        compatible = []
        for detection in candidates:
            distance = hypot(detection.cx - predicted_x, detection.cy - predicted_y)
            if distance > self.max_speed_px_per_frame * gap:
                continue
            size_ratio = self._size_ratio(self._last_detection, detection)
            if size_ratio > self.max_size_ratio:
                continue
            score = (
                distance / (self.max_speed_px_per_frame * gap)
                + .15 * (size_ratio - 1.0)
                - .20 * detection.confidence
            )
            compatible.append((score, detection))
        if not compatible:
            return None
        _, chosen = min(compatible, key=lambda item: item[0])
        previous = self._last_detection
        previous_frame = self._last_observed_frame
        observed_vx = (chosen.cx - previous.cx) / gap
        observed_vy = (chosen.cy - previous.cy) / gap
        alpha = self.velocity_alpha
        self._velocity_x = (1 - alpha) * self._velocity_x + alpha * observed_vx
        self._velocity_y = (1 - alpha) * self._velocity_y + alpha * observed_vy
        self._last_detection = chosen
        self._last_observed_frame = frame_index
        return BallObservation(
            chosen,
            self._segment_id,
            "strong" if chosen.confidence >= self.high_threshold else "weak",
            frame_index,
            frame_index - previous_frame,
        )

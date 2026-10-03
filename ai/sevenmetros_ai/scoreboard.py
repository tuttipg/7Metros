"""Conservative persistent-change detector for fixed broadcast score glyphs.

The detector does not OCR a score. It only reports that a stable binary glyph in a
configured score ROI changed to another stable glyph. This is enough to produce a
team-side score-change confirmation without pretending to know the exact action
frame that caused the delayed broadcast update.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import isfinite


@dataclass(frozen=True)
class ScoreGlyphChange:
    frame_index: int
    confirmation_frame: int
    side: str
    changed_fraction: float
    stable_frames: int


def _fraction_different(a, b) -> float:
    if len(a) != len(b) or not a:
        raise ValueError("glyph signatures must be non-empty and have equal length")
    return sum(int(x) != int(y) for x, y in zip(a, b)) / len(a)


class PersistentScoreGlyphDetector:
    """Detect persistent changes in a fixed thresholded score-digit patch."""

    def __init__(
        self,
        side: str,
        *,
        change_fraction: float = .05,
        same_state_fraction: float = .02,
        stable_frames: int = 5,
        initial_stable_frames: int = 15,
    ) -> None:
        change = float(change_fraction)
        same = float(same_state_fraction)
        if not side:
            raise ValueError("side is required")
        if not isfinite(change) or not 0 < change <= 1:
            raise ValueError("change_fraction must be in (0,1]")
        if not isfinite(same) or not 0 <= same < change:
            raise ValueError("same_state_fraction must be in [0, change_fraction)")
        if isinstance(stable_frames, bool) or int(stable_frames) != stable_frames or stable_frames < 1:
            raise ValueError("stable_frames must be a positive integer")
        if (
            isinstance(initial_stable_frames, bool)
            or int(initial_stable_frames) != initial_stable_frames
            or initial_stable_frames < 1
        ):
            raise ValueError("initial_stable_frames must be a positive integer")
        self.side = side
        self.change_fraction = change
        self.same_state_fraction = same
        self.stable_frames = int(stable_frames)
        self.initial_stable_frames = int(initial_stable_frames)
        self.reset()

    def reset(self) -> None:
        self._stable = None
        self._initial_candidate = None
        self._initial_count = 0
        self._candidate = None
        self._candidate_start = None
        self._candidate_count = 0
        self._last_frame = None

    def update(self, frame_index: int, signature) -> ScoreGlyphChange | None:
        if isinstance(frame_index, bool) or int(frame_index) != frame_index or frame_index < 0:
            raise ValueError("frame_index must be a non-negative integer")
        frame_index = int(frame_index)
        if self._last_frame is not None and frame_index <= self._last_frame:
            raise ValueError("frame_index must increase strictly")
        self._last_frame = frame_index
        signature = tuple(int(v) for v in signature)
        if not signature:
            raise ValueError("signature must not be empty")
        if any(v not in (0, 1) for v in signature):
            raise ValueError("signature must be binary")

        if self._stable is None:
            if (
                self._initial_candidate is None
                or _fraction_different(signature, self._initial_candidate)
                > self.same_state_fraction
            ):
                self._initial_candidate = signature
                self._initial_count = 1
            else:
                self._initial_count += 1
            if self._initial_count >= self.initial_stable_frames:
                self._stable = self._initial_candidate
                self._initial_candidate = None
                self._initial_count = 0
            return None

        from_stable = _fraction_different(signature, self._stable)
        if from_stable <= self.same_state_fraction:
            self._candidate = None
            self._candidate_start = None
            self._candidate_count = 0
            return None

        if from_stable < self.change_fraction:
            self._candidate = None
            self._candidate_start = None
            self._candidate_count = 0
            return None

        if (
            self._candidate is None
            or _fraction_different(signature, self._candidate) > self.same_state_fraction
        ):
            self._candidate = signature
            self._candidate_start = frame_index
            self._candidate_count = 1
            return None

        self._candidate_count += 1
        if self._candidate_count < self.stable_frames:
            return None

        start = int(self._candidate_start)
        changed = _fraction_different(self._candidate, self._stable)
        self._stable = self._candidate
        self._candidate = None
        self._candidate_start = None
        count = self._candidate_count
        self._candidate_count = 0
        return ScoreGlyphChange(
            frame_index=start,
            confirmation_frame=frame_index,
            side=self.side,
            changed_fraction=changed,
            stable_frames=count,
        )

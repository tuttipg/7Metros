"""Conservative possession-candidate assignment from observed ball + player tracks.

This module does not infer possession when the ball is unobserved. It only labels
an observed ball as near one player, ambiguous between players, or unassigned.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import hypot, isfinite

from .ball_tracking import BallObservation
from .tracking import Track


@dataclass(frozen=True)
class PossessionCandidate:
    state: str
    track_id: int | None = None
    team: str | None = None
    normalized_distance: float | None = None
    margin_to_second: float | None = None
    ball_segment_id: int | None = None


def _point_to_box_distance(x: float, y: float, track: Track) -> float:
    box = track.detection
    dx = max(box.x1 - x, 0.0, x - box.x2)
    dy = max(box.y1 - y, 0.0, y - box.y2)
    return hypot(dx, dy)


def assign_possession_candidate(
    ball: BallObservation | None,
    players,
    *,
    max_normalized_distance: float = .35,
    min_margin_to_second: float = .08,
) -> PossessionCandidate:
    max_distance = float(max_normalized_distance)
    margin_required = float(min_margin_to_second)
    if not isfinite(max_distance) or max_distance < 0:
        raise ValueError("max_normalized_distance must be finite and non-negative")
    if not isfinite(margin_required) or margin_required < 0:
        raise ValueError("min_margin_to_second must be finite and non-negative")
    if ball is None:
        return PossessionCandidate(state="ball_unobserved")

    candidates = []
    bx, by = ball.detection.cx, ball.detection.cy
    for track in players:
        detection = track.detection
        height = detection.y2 - detection.y1
        if not isfinite(height) or height <= 0:
            continue
        distance = _point_to_box_distance(bx, by, track)
        normalized = distance / height
        team = track.association_team or detection.team
        candidates.append((normalized, int(track.track_id), team))

    if not candidates:
        return PossessionCandidate(state="observed_unassigned", ball_segment_id=ball.segment_id)
    candidates.sort(key=lambda item: (item[0], item[1]))
    nearest = candidates[0]
    second_distance = candidates[1][0] if len(candidates) > 1 else float("inf")
    margin = second_distance - nearest[0]

    if nearest[0] > max_distance:
        return PossessionCandidate(
            state="observed_unassigned",
            normalized_distance=nearest[0], margin_to_second=margin,
            ball_segment_id=ball.segment_id,
        )
    if margin < margin_required:
        return PossessionCandidate(
            state="observed_ambiguous",
            normalized_distance=nearest[0], margin_to_second=margin,
            ball_segment_id=ball.segment_id,
        )
    return PossessionCandidate(
        state="candidate", track_id=nearest[1], team=nearest[2],
        normalized_distance=nearest[0], margin_to_second=margin,
        ball_segment_id=ball.segment_id,
    )

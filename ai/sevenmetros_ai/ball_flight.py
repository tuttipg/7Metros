"""Detector-backed free-ball flight candidates.

A flight candidate is a contiguous run of observed ball boxes that possession
geometry left unassigned, with sufficient speed and directional consistency.
No missing-frame interpolation is used and the result is not called a pass or shot.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import hypot, isfinite


@dataclass(frozen=True)
class BallFlightCandidate:
    start_frame: int
    end_frame: int
    frames: int
    mean_speed_px_per_frame: float
    max_speed_px_per_frame: float
    net_displacement_px: float
    path_length_px: float
    linearity: float
    segment_id: int | None


def _center(ball_row):
    obj = ball_row.get('observation')
    if obj is None:
        return None
    x1, y1, x2, y2 = [float(v) for v in obj['bbox_xyxy']]
    if not all(isfinite(v) for v in (x1, y1, x2, y2)) or x2 <= x1 or y2 <= y1:
        raise ValueError('invalid ball bbox')
    return ((x1 + x2) / 2, (y1 + y2) / 2, obj.get('segment_id'))


def detect_free_ball_flights(
    ball_rows,
    possession_rows,
    *,
    min_frames: int = 3,
    min_mean_speed_px_per_frame: float = 8.0,
    min_linearity: float = .70,
) -> list[BallFlightCandidate]:
    if isinstance(min_frames, bool) or int(min_frames) != min_frames or min_frames < 2:
        raise ValueError('min_frames must be an integer >= 2')
    speed_threshold = float(min_mean_speed_px_per_frame)
    linearity_threshold = float(min_linearity)
    if not isfinite(speed_threshold) or speed_threshold < 0:
        raise ValueError('min_mean_speed_px_per_frame must be finite and non-negative')
    if not isfinite(linearity_threshold) or not 0 <= linearity_threshold <= 1:
        raise ValueError('min_linearity must be in [0,1]')

    possessions = {int(row['frame_index']): row for row in possession_rows}
    eligible = []
    previous = None
    for row in ball_rows:
        frame = int(row['frame_index'])
        if previous is not None and frame <= previous:
            raise ValueError('ball rows must be strictly ordered')
        previous = frame
        center = _center(row)
        possession = possessions.get(frame)
        if center is None or possession is None or possession.get('state') != 'observed_unassigned':
            eligible.append(None)
        else:
            eligible.append((frame, *center))

    groups = []
    current = []
    for item in eligible:
        if item is None:
            if current: groups.append(current); current = []
            continue
        if current and item[0] != current[-1][0] + 1:
            groups.append(current); current = []
        if current and item[3] != current[-1][3]:
            groups.append(current); current = []
        current.append(item)
    if current: groups.append(current)

    flights = []
    for group in groups:
        if len(group) < int(min_frames):
            continue
        speeds = []
        path_length = 0.0
        for a, b in zip(group, group[1:]):
            step = hypot(b[1] - a[1], b[2] - a[2])
            speeds.append(step)
            path_length += step
        mean_speed = sum(speeds) / len(speeds)
        if mean_speed < speed_threshold:
            continue
        net = hypot(group[-1][1] - group[0][1], group[-1][2] - group[0][2])
        linearity = net / path_length if path_length > 0 else 0.0
        if linearity < linearity_threshold:
            continue
        flights.append(BallFlightCandidate(
            start_frame=group[0][0], end_frame=group[-1][0], frames=len(group),
            mean_speed_px_per_frame=mean_speed,
            max_speed_px_per_frame=max(speeds),
            net_displacement_px=net, path_length_px=path_length,
            linearity=linearity, segment_id=group[0][3],
        ))
    return flights

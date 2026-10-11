"""Conservative image-space shot candidates anchored by visible goalkeeper roles.

The camera may pan, so no fixed pixel goal region is assumed. Instead, a temporary
proxy for the goal mouth is derived from a currently visible goalkeeper track. A
free-ball flight becomes ``SHOT?`` only when its observed trajectory, extrapolated
forward without changing direction, intersects that proxy within a short horizon.

This is geometry evidence, not a confirmed shot or goal label.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import hypot, isfinite


@dataclass(frozen=True)
class GoalMouthProxy:
    frame_index: int
    goalkeeper_track_id: int
    role_candidate: str
    defending_team: str
    bbox_xyxy: tuple[float, float, float, float]


@dataclass(frozen=True)
class ShotGeometryCandidate:
    flight_start_frame: int
    flight_end_frame: int
    goalkeeper_track_id: int
    goal_role_candidate: str
    defending_team: str
    velocity_xy: tuple[float, float]
    projected_frames: float
    intersection_xy: tuple[float, float]
    goal_proxy_bbox_xyxy: tuple[float, float, float, float]


def _finite(value) -> float:
    value = float(value)
    if not isfinite(value):
        raise ValueError("geometry values must be finite")
    return value


def goal_mouth_proxies(
    player_row,
    *,
    horizontal_half_width_height_ratio: float = .85,
    top_expand_height_ratio: float = .15,
    bottom_expand_height_ratio: float = .15,
) -> list[GoalMouthProxy]:
    """Build dynamic goal-mouth proxies from ``*_GK`` player-role observations."""
    half = _finite(horizontal_half_width_height_ratio)
    top = _finite(top_expand_height_ratio)
    bottom = _finite(bottom_expand_height_ratio)
    if half <= 0 or top < 0 or bottom < 0:
        raise ValueError("goal proxy scale values must be non-negative and width positive")
    frame = int(player_row["frame_index"])
    width = int(player_row.get("image", {}).get("width", 0) or 0)
    height = int(player_row.get("image", {}).get("height", 0) or 0)
    result = []
    for obj in player_row.get("objects", []):
        role = obj.get("role_candidate")
        if not isinstance(role, str) or not role.endswith("_GK"):
            continue
        values = [_finite(v) for v in obj["bbox_xyxy"]]
        x1, y1, x2, y2 = values
        if x2 <= x1 or y2 <= y1:
            raise ValueError("goalkeeper bbox must have positive area")
        h = y2 - y1
        cx = (x1 + x2) / 2.0
        gx1 = cx - half * h
        gx2 = cx + half * h
        gy1 = y1 - top * h
        gy2 = y2 + bottom * h
        if width > 0:
            gx1, gx2 = max(0.0, gx1), min(float(width), gx2)
        if height > 0:
            gy1, gy2 = max(0.0, gy1), min(float(height), gy2)
        result.append(GoalMouthProxy(
            frame_index=frame,
            goalkeeper_track_id=int(obj["track_id"]),
            role_candidate=role,
            defending_team=role[:-3],
            bbox_xyxy=(gx1, gy1, gx2, gy2),
        ))
    return result


def _ray_box_intersection(px, py, vx, vy, box, max_projection_frames):
    x1, y1, x2, y2 = box
    hits = []
    if abs(vx) > 1e-12:
        for x in (x1, x2):
            t = (x - px) / vx
            if 0 < t <= max_projection_frames:
                y = py + vy * t
                if y1 <= y <= y2:
                    hits.append((t, x, y))
    if abs(vy) > 1e-12:
        for y in (y1, y2):
            t = (y - py) / vy
            if 0 < t <= max_projection_frames:
                x = px + vx * t
                if x1 <= x <= x2:
                    hits.append((t, x, y))
    return min(hits, default=None, key=lambda item: item[0])


def _center_from_ball_row(row):
    obs = row.get("observation")
    if obs is None:
        return None
    x1, y1, x2, y2 = [_finite(v) for v in obs["bbox_xyxy"]]
    if x2 <= x1 or y2 <= y1:
        raise ValueError("ball bbox must have positive area")
    return (int(row["frame_index"]), (x1 + x2) / 2.0, (y1 + y2) / 2.0,
            obs.get("segment_id"))


def detect_shot_geometry_candidates(
    flights,
    ball_rows,
    player_rows,
    *,
    min_observed_points: int = 3,
    max_projection_frames: float = 30.0,
    horizontal_half_width_height_ratio: float = .85,
    top_expand_height_ratio: float = .15,
    bottom_expand_height_ratio: float = .15,
) -> list[ShotGeometryCandidate]:
    """Return only flights whose forward ray intersects a dynamic goal proxy."""
    if isinstance(min_observed_points, bool) or int(min_observed_points) != min_observed_points or min_observed_points < 2:
        raise ValueError("min_observed_points must be an integer >= 2")
    horizon = _finite(max_projection_frames)
    if horizon <= 0:
        raise ValueError("max_projection_frames must be positive")
    ball_map = {int(row["frame_index"]): row for row in ball_rows}
    player_map = {int(row["frame_index"]): row for row in player_rows}
    output = []
    for flight in flights:
        start = int(flight.start_frame)
        end = int(flight.end_frame)
        if end <= start:
            continue
        points = []
        for frame in range(start, end + 1):
            row = ball_map.get(frame)
            point = _center_from_ball_row(row) if row is not None else None
            if point is None:
                continue
            segment = point[3]
            expected_segment = getattr(flight, "segment_id", None)
            if expected_segment is not None and segment != expected_segment:
                continue
            points.append(point)
        if len(points) < int(min_observed_points):
            continue
        f0, x0, y0, _ = points[0]
        f1, x1, y1, _ = points[-1]
        dt = f1 - f0
        if dt <= 0:
            continue
        vx, vy = (x1 - x0) / dt, (y1 - y0) / dt
        if hypot(vx, vy) <= 1e-9:
            continue
        player_row = player_map.get(end)
        if player_row is None:
            continue
        proxies = goal_mouth_proxies(
            player_row,
            horizontal_half_width_height_ratio=horizontal_half_width_height_ratio,
            top_expand_height_ratio=top_expand_height_ratio,
            bottom_expand_height_ratio=bottom_expand_height_ratio,
        )
        best = None
        for proxy in proxies:
            hit = _ray_box_intersection(x1, y1, vx, vy, proxy.bbox_xyxy, horizon)
            if hit is None:
                continue
            if best is None or hit[0] < best[0][0]:
                best = (hit, proxy)
        if best is None:
            continue
        hit, proxy = best
        output.append(ShotGeometryCandidate(
            flight_start_frame=start,
            flight_end_frame=end,
            goalkeeper_track_id=proxy.goalkeeper_track_id,
            goal_role_candidate=proxy.role_candidate,
            defending_team=proxy.defending_team,
            velocity_xy=(vx, vy),
            projected_frames=hit[0],
            intersection_xy=(hit[1], hit[2]),
            goal_proxy_bbox_xyxy=proxy.bbox_xyxy,
        ))
    return output

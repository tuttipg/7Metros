"""Small dark-motion proposals for ball diagnostics.

This module intentionally emits *motion candidates*, not ball detections.  It
uses three consecutive frames so a stationary court marking cannot create a
candidate.  The caller must still validate identity and event semantics.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import hypot


@dataclass(frozen=True)
class MotionCandidate:
    bbox_xyxy: tuple[int, int, int, int]
    center_xy: tuple[float, float]
    area: int
    darkness: float
    score: float


@dataclass(frozen=True)
class MotionTracklet:
    start_frame: int
    end_frame: int
    points: tuple[MotionCandidate, ...]
    mean_speed: float
    linearity: float

    @property
    def frames(self):
        return len(self.points)


class TemporalMotionBallProposer:
    """Propose small dark moving blobs after global frame registration."""

    def __init__(self, *, difference_threshold=22, min_area=2, max_area=180,
                 max_side=30, min_darkness=8, top=65, bottom=460):
        values = (difference_threshold, min_area, max_area, max_side, min_darkness)
        if any(float(value) < 0 for value in values):
            raise ValueError("proposal thresholds must be non-negative")
        if not 0 < int(min_area) <= int(max_area) or int(max_side) <= 0:
            raise ValueError("invalid component size limits")
        if int(top) < 0 or int(bottom) <= int(top):
            raise ValueError("invalid vertical limits")
        self.difference_threshold = int(difference_threshold)
        self.min_area = int(min_area)
        self.max_area = int(max_area)
        self.max_side = int(max_side)
        self.min_darkness = float(min_darkness)
        self.top = int(top)
        self.bottom = int(bottom)

    @staticmethod
    def _register(reference, moving):
        import cv2
        import numpy as np
        reference_gray = cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY)
        moving_gray = cv2.cvtColor(moving, cv2.COLOR_BGR2GRAY)
        warp = np.eye(2, 3, dtype=np.float32)
        try:
            cv2.findTransformECC(
                reference_gray, moving_gray, warp, cv2.MOTION_EUCLIDEAN,
                (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 40, 1e-4),
                None, 3,
            )
            return cv2.warpAffine(
                moving, warp, (reference.shape[1], reference.shape[0]),
                flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
                borderMode=cv2.BORDER_REFLECT,
            )
        except cv2.error:
            return moving

    def propose(self, previous, current, following, player_boxes=()):
        import cv2
        import numpy as np
        if previous.shape != current.shape or following.shape != current.shape:
            raise ValueError("three frames must have identical shapes")
        previous = self._register(current, previous)
        following = self._register(current, following)
        gray = cv2.cvtColor(current, cv2.COLOR_BGR2GRAY)
        prior_gray = cv2.cvtColor(previous, cv2.COLOR_BGR2GRAY)
        next_gray = cv2.cvtColor(following, cv2.COLOR_BGR2GRAY)
        residue = cv2.min(cv2.absdiff(gray, prior_gray), cv2.absdiff(gray, next_gray))
        residue = cv2.GaussianBlur(residue, (3, 3), 0)
        mask = (residue >= self.difference_threshold).astype(np.uint8) * 255
        mask[:min(self.top, mask.shape[0])] = 0
        mask[min(self.bottom, mask.shape[0]):] = 0
        for box in player_boxes:
            x1, y1, x2, y2 = [int(round(value)) for value in box]
            cv2.rectangle(
                mask, (max(0, x1 - 3), max(0, y1 - 3)),
                (min(mask.shape[1] - 1, x2 + 3), min(mask.shape[0] - 1, y2 + 3)),
                0, -1,
            )
        count, labels, stats, centroids = cv2.connectedComponentsWithStats(mask)
        output = []
        for component in range(1, count):
            x, y, width, height, area = [int(value) for value in stats[component]]
            if not self.min_area <= area <= self.max_area:
                continue
            if width > self.max_side or height > self.max_side:
                continue
            pad = 5
            xa, ya = max(0, x - pad), max(0, y - pad)
            xb = min(gray.shape[1], x + width + pad)
            yb = min(gray.shape[0], y + height + pad)
            component_mask = labels == component
            darkness = float(np.median(gray[ya:yb, xa:xb]) - np.median(gray[component_mask]))
            if darkness < self.min_darkness:
                continue
            score = (
                float(residue[component_mask].mean()) * (1 + min(area, 20) / 20)
                + 2 * darkness
            )
            output.append(MotionCandidate(
                bbox_xyxy=(x, y, x + width, y + height),
                center_xy=(float(centroids[component][0]), float(centroids[component][1])),
                area=area, darkness=darkness, score=score,
            ))
        return sorted(output, key=lambda item: -item.score)


def link_motion_candidates(rows, *, max_candidates=30, min_speed=2,
                           max_speed=85, max_acceleration=35):
    """Greedily link candidate rows; output remains diagnostic proposals."""
    active = []
    completed = []
    for frame, candidates in rows:
        candidates = list(candidates[:max_candidates])
        next_active = []
        used = set()
        for start, points in active:
            px, py = points[-1].center_xy
            vx = vy = 0.0
            if len(points) >= 2:
                qx, qy = points[-2].center_xy
                vx, vy = px - qx, py - qy
            choices = []
            for index, candidate in enumerate(candidates):
                x, y = candidate.center_xy
                dx, dy = x - px, y - py
                speed = hypot(dx, dy)
                acceleration = hypot(dx - vx, dy - vy) if len(points) >= 2 else 0.0
                if min_speed <= speed <= max_speed and acceleration <= max_acceleration:
                    choices.append((acceleration + .05 * speed - .002 * candidate.score,
                                    index, candidate))
            if choices:
                _, index, candidate = min(choices)
                used.add(index)
                extended = points + (candidate,)
                next_active.append((start, extended))
                if len(extended) >= 3:
                    xy = [point.center_xy for point in extended]
                    steps = [hypot(xy[i][0] - xy[i-1][0], xy[i][1] - xy[i-1][1])
                             for i in range(1, len(xy))]
                    path = sum(steps)
                    net = hypot(xy[-1][0] - xy[0][0], xy[-1][1] - xy[0][1])
                    completed.append(MotionTracklet(
                        start, frame, extended, sum(steps) / len(steps),
                        net / path if path else 0.0,
                    ))
        for index, candidate in enumerate(candidates):
            if index not in used:
                next_active.append((frame, (candidate,)))
        active = next_active
    unique = {}
    for tracklet in completed:
        key = tuple((round(point.center_xy[0]), round(point.center_xy[1]))
                    for point in tracklet.points)
        unique[key] = tracklet
    return sorted(unique.values(), key=lambda item: (-item.frames, -item.linearity, -item.mean_speed))

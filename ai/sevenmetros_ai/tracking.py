from __future__ import annotations

from dataclasses import dataclass, replace
from collections import Counter, deque
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
    role_candidate: Optional[str] = None

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
    association_team: Optional[str] = None

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
    old_team = track.association_team or track.detection.team
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
        temporal_teams: bool = False,
        velocity_alpha: float = 1.0,
        assignment: str = 'greedy',
        two_stage: bool = False,
        high_threshold: float = .25,
        low_threshold: float = .10,
        weak_iou: float = .20,
    ) -> None:
        if max_distance <= 0:
            raise ValueError("max_distance must be > 0")
        if max_missed < 0:
            raise ValueError("max_missed must be >= 0")
        if not 0.0 <= iou_weight <= 1.0:
            raise ValueError("iou_weight must be between 0 and 1")
        self.max_distance = float(max_distance)
        if assignment not in ('greedy', 'global'):
            raise ValueError('assignment must be greedy or global')
        self.assignment = assignment
        if not 0 <= low_threshold < high_threshold <= 1:
            raise ValueError('Require 0 <= low_threshold < high_threshold <= 1')
        if not 0 < weak_iou <= 1:
            raise ValueError('weak_iou must be in (0,1]')
        self.two_stage = two_stage
        self.high_threshold = high_threshold
        self.low_threshold = low_threshold
        self.weak_iou = weak_iou
        if not 0 < velocity_alpha <= 1:
            raise ValueError('velocity_alpha must be in (0, 1]')
        self.velocity_alpha = float(velocity_alpha)
        self.max_missed = int(max_missed)
        self.iou_weight = float(iou_weight)
        self.temporal_teams = temporal_teams
        self._team_history = {}
        self._role_history = {}
        self._roles = {}
        self._next_id = 1
        self._tracks: dict[int, Track] = {}

    def update(self, detections: Iterable[Detection]) -> list[Track]:
        detections = list(detections)

        unmatched_track_ids = set(self._tracks)
        unmatched_detection_indexes = set(range(len(detections)))
        candidates: list[tuple[float, int, int]] = []
        weak_candidates: list[tuple[float, int, int]] = []

        for track_id, track in self._tracks.items():
            for idx, detection in enumerate(detections):
                if self.two_stage and detection.confidence < self.high_threshold:
                    # Conservative second stage: only maintain currently active
                    # tracks, never resurrect old identities on weak evidence.
                    overlap = bbox_iou(track.detection, detection)
                    if (detection.confidence >= self.low_threshold and track.missed == 0
                            and _compatible(track, detection) and overlap >= self.weak_iou
                            and hypot(track.predicted_cx-detection.cx, track.predicted_cy-detection.cy) <= self.max_distance):
                        weak_candidates.append((1-overlap, track_id, idx))
                    continue
                if track.detection.label != detection.label:
                    continue
                if not self.temporal_teams and not _compatible(track, detection):
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
                    if (self.temporal_teams and track.association_team is not None
                            and detection.team is not None and track.association_team != detection.team):
                        candidates[-1] = (cost + self.max_distance * .5, track_id, idx)

        associations = sorted(candidates)
        if self.assignment == 'global' and candidates:
            associations = self._global_associations(candidates, len(detections))
        associations += sorted(weak_candidates)
        for _, track_id, idx in associations:
            if track_id not in unmatched_track_ids or idx not in unmatched_detection_indexes:
                continue
            track = self._tracks[track_id]
            previous_cx = track.detection.cx
            previous_cy = track.detection.cy
            elapsed_frames = track.missed + 1
            track.detection = detections[idx]
            alpha = self.velocity_alpha if track.age > 1 else 1.0
            track.velocity_x = (1-alpha)*track.velocity_x + alpha*(track.detection.cx - previous_cx)/elapsed_frames
            track.velocity_y = (1-alpha)*track.velocity_y + alpha*(track.detection.cy - previous_cy)/elapsed_frames
            weak = self.two_stage and track.detection.confidence < self.high_threshold
            if self.temporal_teams and not weak:
                self._observe_team(track)
            elif not weak and track.detection.team is not None:
                track.association_team = track.detection.team
            track.age += 1
            track.missed = 0
            unmatched_track_ids.remove(track_id)
            unmatched_detection_indexes.remove(idx)

        for track_id in list(unmatched_track_ids):
            track = self._tracks[track_id]
            track.missed += 1
            if track.missed > self.max_missed:
                del self._tracks[track_id]
                self._team_history.pop(track_id, None)
                self._role_history.pop(track_id, None)
                self._roles.pop(track_id, None)

        for idx in sorted(unmatched_detection_indexes):
            if self.two_stage and detections[idx].confidence < self.high_threshold:
                continue
            self._tracks[self._next_id] = Track(
                track_id=self._next_id,
                detection=detections[idx],
                association_team=None if self.temporal_teams else detections[idx].team,
            )
            if self.temporal_teams:
                self._observe_team(self._tracks[self._next_id])
            self._next_id += 1

        return [
            Track(
                track_id=t.track_id,
                detection=replace(t.detection, team=None if self._roles.get(t.track_id) else t.association_team,
                                  role_candidate=self._roles.get(t.track_id)) if self.temporal_teams else t.detection,
                age=t.age,
                missed=t.missed,
                velocity_x=t.velocity_x,
                velocity_y=t.velocity_y,
                association_team=t.association_team,
            )
            for t in sorted(self._tracks.values(), key=lambda item: item.track_id)
            if t.missed == 0
        ]

    def _global_associations(self, candidates, detection_count):
        """Minimum-cost one-to-one assignment with explicit unmatched tracks.

        Geometric/team gates still apply. This is not appearance ReID.
        SciPy is optional and only imported for the experimental global mode.
        """
        import numpy as np
        from scipy.optimize import linear_sum_assignment
        ids=sorted(self._tracks)
        row_by_id={tid:i for i,tid in enumerate(ids)}
        unmatched=self.max_distance*2
        costs=np.full((len(ids),detection_count+len(ids)),unmatched)
        costs[:,:detection_count]=np.inf
        for cost,tid,idx in candidates:costs[row_by_id[tid],idx]=cost
        rows,cols=linear_sum_assignment(costs)
        return [(float(costs[row,col]),ids[row],int(col)) for row,col in zip(rows,cols)
                if col<detection_count and np.isfinite(costs[row,col])]

    def _observe_team(self, track):
        history = self._team_history.setdefault(track.track_id, deque(maxlen=12))
        history.append(track.detection.team)
        roles = self._role_history.setdefault(track.track_id, deque(maxlen=12))
        roles.append(track.detection.role_candidate)
        votes = Counter(r for r in roles if r is not None)
        if votes:
            role, count = votes.most_common(1)[0]
            if count >= 3 and count / len(roles) >= .75:
                self._roles[track.track_id] = role
            elif self._roles.get(track.track_id) not in votes:
                self._roles.pop(track.track_id, None)
        else:
            self._roles.pop(track.track_id, None)
        votes = Counter(t for t in history if t is not None)
        if not votes:
            track.association_team = None
            return
        team, count = votes.most_common(1)[0]
        if count >= 3 and count / len(history) >= .75:
            track.association_team = team
        elif track.association_team not in votes:
            track.association_team = None

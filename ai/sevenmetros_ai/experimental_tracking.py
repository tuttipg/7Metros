"""Opt-in tracking experiments that must not change the baseline defaults."""
from __future__ import annotations

from dataclasses import replace
from math import isfinite

from .tracking import CentroidTracker, bbox_iou


def _geometry_key(detection):
    """Stable key across temporal team/role presentation replacements."""
    return (
        float(detection.x1), float(detection.y1),
        float(detection.x2), float(detection.y2),
        float(detection.confidence), detection.label,
    )


def _compatible(track, detection):
    if track.detection.label != detection.label:
        return False
    old_team = track.association_team or track.detection.team
    new_team = detection.team
    return old_team is None or new_team is None or old_team == new_team


class AmbiguityVelocityTracker(CentroidTracker):
    """Preserve motion state when a strong box plausibly covers two tracks.

    Association and output remain unchanged.  Only the velocity update caused by
    a matched *strong* detection is rolled back when that detection overlapped at
    least two currently visible compatible tracks before association.  This is
    deliberately experimental: fused boxes can corrupt constant-velocity state,
    but the rule still needs official validation on the persisted confidence-0.10
    replay before it can be considered for the main tracker.
    """

    def __init__(self, *args, ambiguity_iou=.30, **kwargs):
        if not isfinite(float(ambiguity_iou)) or not 0 < float(ambiguity_iou) <= 1:
            raise ValueError('ambiguity_iou must be finite and in (0,1]')
        super().__init__(*args, **kwargs)
        self.ambiguity_iou = float(ambiguity_iou)
        self.ambiguous_velocity_freezes = 0

    def _ambiguous_detection_keys(self, detections):
        ambiguous = set()
        visible_tracks = [track for track in self.active_tracks if track.missed == 0]
        if len(visible_tracks) < 2:
            return ambiguous
        for detection in detections:
            # The observed failure mode is a high-confidence fused box winning
            # before the low-confidence maintenance stage.  Weak boxes are not
            # modified by this experiment.
            if detection.confidence < self.high_threshold:
                continue
            overlaps = sum(
                _compatible(track, detection)
                and bbox_iou(track.detection, detection) >= self.ambiguity_iou
                for track in visible_tracks
            )
            if overlaps >= 2:
                ambiguous.add(_geometry_key(detection))
        return ambiguous

    def update(self, detections, spawnable=None):
        detections = list(detections)
        ambiguous = self._ambiguous_detection_keys(detections)
        previous_velocity = {
            track.track_id: (track.velocity_x, track.velocity_y)
            for track in self.active_tracks
        }

        tracks = super().update(detections, spawnable=spawnable)
        if not ambiguous or not previous_velocity:
            return tracks

        restore_ids = {
            track.track_id
            for track in tracks
            if track.track_id in previous_velocity
            and _geometry_key(track.detection) in ambiguous
        }
        if not restore_ids:
            return tracks

        for track_id in restore_ids:
            internal = self._tracks.get(track_id)
            if internal is None or internal.missed:
                continue
            internal.velocity_x, internal.velocity_y = previous_velocity[track_id]

        self.ambiguous_velocity_freezes += len(restore_ids)
        return [
            replace(
                track,
                velocity_x=previous_velocity[track.track_id][0],
                velocity_y=previous_velocity[track.track_id][1],
            ) if track.track_id in restore_ids else track
            for track in tracks
        ]

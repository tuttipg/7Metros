"""Conservative temporal role filtering for tracker output.

Filtering happens after association so excluded officials remain internally
tracked and cannot repeatedly spawn new identities.  This module only acts on
explicit role candidates; it does not infer roles from track position.
"""
from collections import Counter, deque


class TemporalRoleFilter:
    """Exclude a role only after repeated observations for one track ID."""

    def __init__(
        self,
        excluded_roles=('referee',),
        *,
        window=12,
        min_votes=3,
        min_ratio=.75,
        max_missing=30,
    ):
        if window <= 0 or min_votes <= 0 or max_missing < 0:
            raise ValueError('window/min_votes must be positive and max_missing non-negative')
        if not 0 < min_ratio <= 1:
            raise ValueError('min_ratio must be in (0,1]')
        self.excluded_roles = frozenset(excluded_roles)
        self.window = int(window)
        self.min_votes = int(min_votes)
        self.min_ratio = float(min_ratio)
        self.max_missing = int(max_missing)
        self._history = {}
        self._last_seen = {}
        self._confirmed = {}

    def filter(self, tracks, frame_index):
        tracks = list(tracks)
        for track in tracks:
            track_id = track.track_id
            self._last_seen[track_id] = frame_index
            role = track.observed_role_candidate
            if role is None:
                continue
            history = self._history.setdefault(track_id, deque(maxlen=self.window))
            history.append(role)
            counts = Counter(history)
            candidate, votes = counts.most_common(1)[0]
            if votes >= self.min_votes and votes / len(history) >= self.min_ratio:
                self._confirmed[track_id] = candidate

        expired = [
            track_id for track_id, last_seen in self._last_seen.items()
            if frame_index - last_seen > self.max_missing
        ]
        for track_id in expired:
            self._history.pop(track_id, None)
            self._last_seen.pop(track_id, None)
            self._confirmed.pop(track_id, None)

        kept = [
            track for track in tracks
            if self._confirmed.get(track.track_id) not in self.excluded_roles
        ]
        return kept, len(tracks) - len(kept)

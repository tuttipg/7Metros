import unittest

from sevenmetros_ai.role_filter import TemporalRoleFilter
from sevenmetros_ai.tracking import Detection, Track


def _track(track_id=1, role=None):
    return Track(track_id, Detection(0, 0, 10, 20, role_candidate=role))


class TemporalRoleFilterTests(unittest.TestCase):
    def test_requires_three_consistent_votes(self):
        role_filter = TemporalRoleFilter()
        for frame in range(2):
            visible, excluded = role_filter.filter([_track(role='referee')], frame)
            self.assertEqual(len(visible), 1)
            self.assertEqual(excluded, 0)
        visible, excluded = role_filter.filter([_track(role='referee')], 2)
        self.assertEqual(visible, [])
        self.assertEqual(excluded, 1)

    def test_single_conflicting_vote_does_not_confirm(self):
        role_filter = TemporalRoleFilter()
        roles = ['referee', 'Ferro_GK', 'referee']
        for frame, role in enumerate(roles):
            visible, excluded = role_filter.filter([_track(role=role)], frame)
        self.assertEqual(len(visible), 1)
        self.assertEqual(excluded, 0)

    def test_confirmation_persists_through_unknown_observation(self):
        role_filter = TemporalRoleFilter()
        for frame in range(3):
            role_filter.filter([_track(role='referee')], frame)
        visible, excluded = role_filter.filter([_track(role=None)], 3)
        self.assertEqual(visible, [])
        self.assertEqual(excluded, 1)

    def test_expired_identity_does_not_reuse_confirmation(self):
        role_filter = TemporalRoleFilter(max_missing=1)
        for frame in range(3):
            role_filter.filter([_track(role='referee')], frame)
        role_filter.filter([], 4)
        role_filter.filter([], 5)
        visible, excluded = role_filter.filter([_track(role=None)], 6)
        self.assertEqual(len(visible), 1)
        self.assertEqual(excluded, 0)


if __name__ == '__main__':
    unittest.main()

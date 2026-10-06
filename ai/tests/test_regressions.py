import unittest

from sevenmetros_ai.tracking import CentroidTracker, Detection


def person(x, team=None, label='player'):
    return Detection(x, 0, x + 10, 20, team=team, label=label)


class RegressionTests(unittest.TestCase):
    def test_velocity_is_per_frame_after_occlusion(self):
        tracker = CentroidTracker(max_distance=11, max_missed=3)
        tracker.update([person(0)])
        tracker.update([person(10)])
        tracker.update([])
        tracker.update([])
        recovered = tracker.update([person(40)])[0]
        self.assertEqual(recovered.track_id, 1)
        self.assertEqual(recovered.velocity_x, 10)
        self.assertEqual(tracker.update([person(50)])[0].track_id, 1)

    def test_unknown_color_does_not_erase_team_gate(self):
        tracker = CentroidTracker()
        tracker.update([person(0, 'home')])
        tracker.update([person(1)])
        self.assertNotEqual(tracker.update([person(2, 'away')])[0].track_id, 1)

    def test_known_roles_remain_separate(self):
        tracker = CentroidTracker()
        ids = [tracker.update([person(0, label=role)])[0].track_id
               for role in ('player', 'goalkeeper', 'referee')]
        self.assertEqual(len(set(ids)), 3)


if __name__ == '__main__':
    unittest.main()

import unittest

from sevenmetros_ai.experimental_tracking import AmbiguityVelocityTracker
from sevenmetros_ai.tracking import Detection


class AmbiguityVelocityTrackerTests(unittest.TestCase):
    def test_rejects_invalid_ambiguity_iou(self):
        for value in (0, -0.1, 1.1, float('nan')):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    AmbiguityVelocityTracker(ambiguity_iou=value)

    def test_normal_detection_still_updates_velocity(self):
        tracker = AmbiguityVelocityTracker(max_distance=50)
        tracker.update([Detection(0, 0, 10, 10)])
        second = tracker.update([Detection(5, 0, 15, 10)])[0]
        third = tracker.update([Detection(12, 0, 22, 10)])[0]
        self.assertEqual(second.velocity_x, 5.0)
        self.assertEqual(third.velocity_x, 7.0)
        self.assertEqual(tracker.ambiguous_velocity_freezes, 0)

    def test_fused_strong_box_preserves_previous_velocity(self):
        tracker = AmbiguityVelocityTracker(
            max_distance=50, ambiguity_iou=.30,
        )
        tracker.update([
            Detection(0, 0, 10, 10),
            Detection(20, 0, 30, 10),
        ])
        prior = tracker.update([
            Detection(5, 0, 15, 10),
            Detection(15, 0, 25, 10),
        ])
        prior_velocity = {
            track.track_id: (track.velocity_x, track.velocity_y)
            for track in prior
        }

        # IoU is > .30 against both visible tracks, so whichever ID wins the
        # normal association must not learn motion from this fused observation.
        fused = tracker.update([
            Detection(8, 0, 23, 10, confidence=.9),
        ])
        self.assertEqual(len(fused), 1)
        matched = fused[0]
        self.assertEqual(
            (matched.velocity_x, matched.velocity_y),
            prior_velocity[matched.track_id],
        )
        internal = {
            track.track_id: track for track in tracker.active_tracks
        }[matched.track_id]
        self.assertEqual(
            (internal.velocity_x, internal.velocity_y),
            prior_velocity[matched.track_id],
        )
        self.assertEqual(tracker.ambiguous_velocity_freezes, 1)

    def test_weak_fused_box_is_not_changed_by_this_experiment(self):
        tracker = AmbiguityVelocityTracker(
            max_distance=50, ambiguity_iou=.30, two_stage=True,
        )
        tracker.update([
            Detection(0, 0, 10, 10),
            Detection(20, 0, 30, 10),
        ])
        tracker.update([
            Detection(5, 0, 15, 10),
            Detection(15, 0, 25, 10),
        ])
        tracker.update([Detection(8, 0, 23, 10, confidence=.20)])
        self.assertEqual(tracker.ambiguous_velocity_freezes, 0)


if __name__ == '__main__':
    unittest.main()

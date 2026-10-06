import unittest

from sevenmetros_ai.ball_tracking import BallObservationTracker
from sevenmetros_ai.tracking import Detection


def ball(x, y, confidence=.2, size=10):
    return Detection(
        x1=x - size / 2, y1=y - size / 2,
        x2=x + size / 2, y2=y + size / 2,
        confidence=confidence, label="ball",
    )


class BallObservationTrackerTests(unittest.TestCase):
    def test_weak_detection_cannot_spawn(self):
        tracker = BallObservationTracker(low_threshold=.02, high_threshold=.10)
        self.assertIsNone(tracker.update(0, [ball(10, 10, .05)]))
        self.assertFalse(tracker.active)

    def test_strong_spawns_and_weak_can_continue(self):
        tracker = BallObservationTracker(low_threshold=.02, high_threshold=.10)
        first = tracker.update(0, [ball(10, 10, .4)])
        second = tracker.update(1, [ball(18, 10, .03)])
        self.assertEqual(first.segment_id, 1)
        self.assertEqual(first.stage, "strong")
        self.assertEqual(second.segment_id, 1)
        self.assertEqual(second.stage, "weak")
        self.assertEqual(second.gap_from_previous, 1)

    def test_missing_frame_is_not_interpolated(self):
        tracker = BallObservationTracker()
        tracker.update(0, [ball(10, 10, .4)])
        self.assertIsNone(tracker.update(1, []))
        resumed = tracker.update(2, [ball(20, 10, .04)])
        self.assertIsNotNone(resumed)
        self.assertEqual(resumed.gap_from_previous, 2)

    def test_stale_segment_requires_new_strong_detection(self):
        tracker = BallObservationTracker(max_missed=1)
        tracker.update(0, [ball(10, 10, .4)])
        self.assertIsNone(tracker.update(1, []))
        self.assertIsNone(tracker.update(2, []))
        self.assertIsNone(tracker.update(3, [ball(20, 10, .03)]))
        restarted = tracker.update(4, [ball(20, 10, .4)])
        self.assertEqual(restarted.segment_id, 2)
        self.assertIsNone(restarted.gap_from_previous)

    def test_remote_false_positive_is_not_selected(self):
        tracker = BallObservationTracker(max_speed_px_per_frame=20)
        tracker.update(0, [ball(10, 10, .4)])
        self.assertIsNone(tracker.update(1, [ball(200, 200, .9)]))

    def test_size_jump_is_rejected(self):
        tracker = BallObservationTracker(max_size_ratio=2)
        tracker.update(0, [ball(10, 10, .4, size=10)])
        self.assertIsNone(tracker.update(1, [ball(12, 10, .4, size=40)]))

    def test_velocity_prediction_prefers_motion_consistent_candidate(self):
        tracker = BallObservationTracker(max_speed_px_per_frame=50, velocity_alpha=1)
        tracker.update(0, [ball(0, 0, .4)])
        tracker.update(1, [ball(20, 0, .4)])
        selected = tracker.update(2, [ball(40, 0, .03), ball(22, 0, .9)])
        self.assertAlmostEqual(selected.detection.cx, 40)

    def test_validates_configuration_and_frame_order(self):
        with self.assertRaises(ValueError): BallObservationTracker(low_threshold=.2, high_threshold=.1)
        with self.assertRaises(ValueError): BallObservationTracker(max_missed=-1)
        with self.assertRaises(ValueError): BallObservationTracker(max_speed_px_per_frame=0)
        with self.assertRaises(ValueError): BallObservationTracker(max_size_ratio=.5)
        with self.assertRaises(ValueError): BallObservationTracker(velocity_alpha=0)
        tracker = BallObservationTracker()
        tracker.update(1, [])
        with self.assertRaises(ValueError): tracker.update(1, [])


if __name__ == '__main__':
    unittest.main()

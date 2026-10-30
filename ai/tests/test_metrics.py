import unittest
from types import SimpleNamespace

from sevenmetros_ai.metrics import TrackingMetrics


class TrackingMetricsTests(unittest.TestCase):
    @staticmethod
    def track(track_id):
        return SimpleNamespace(track_id=track_id)

    def test_empty_summary_is_zeroed(self):
        metrics = TrackingMetrics()
        self.assertEqual(metrics.summary()["unique_tracks"], 0)
        self.assertEqual(metrics.summary()["single_frame_track_ratio"], 0.0)

    def test_metrics_capture_track_lifetime_and_churn(self):
        metrics = TrackingMetrics()
        metrics.observe(0, [self.track(1), self.track(2)])
        metrics.observe(1, [self.track(1)])
        metrics.observe(2, [self.track(1), self.track(3)])
        summary = metrics.summary()
        self.assertEqual(summary["frames_observed"], 3)
        self.assertEqual(summary["track_observations"], 5)
        self.assertEqual(summary["unique_tracks"], 3)
        self.assertEqual(summary["max_observations_per_track"], 3)
        self.assertEqual(summary["single_frame_tracks"], 2)
        self.assertAlmostEqual(summary["single_frame_track_ratio"], 2 / 3, places=6)
        self.assertEqual(summary["new_track_rate_per_100_frames"], 100.0)


if __name__ == "__main__":
    unittest.main()

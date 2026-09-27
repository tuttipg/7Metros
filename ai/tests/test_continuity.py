import unittest
from types import SimpleNamespace
from sevenmetros_ai.metrics import TrackingMetrics


class ContinuityTests(unittest.TestCase):
    def test_gap_does_not_count_as_continuous_tracking(self):
        m=TrackingMetrics();t=SimpleNamespace(track_id=1)
        for frame,tracks in [(0,[t]),(1,[t]),(2,[]),(3,[]),(4,[t])]:m.observe(frame,tracks)
        s=m.summary()
        self.assertEqual(s['mean_track_span_frames'],5)
        self.assertEqual(s['mean_continuous_run_frames'],1.5)
        self.assertEqual(s['reappearances_same_id'],1)
        self.assertEqual(s['internal_missing_observations'],2)
        self.assertEqual(s,m.summary())

    def test_end_of_video_absence_is_not_reappearance(self):
        m=TrackingMetrics();m.observe(0,[SimpleNamespace(track_id=1)]);m.observe(1,[])
        self.assertEqual(m.summary()['reappearances_same_id'],0)

    def test_duplicate_and_out_of_order_rejected(self):
        m=TrackingMetrics();t=SimpleNamespace(track_id=1)
        with self.assertRaises(ValueError):m.observe(0,[t,t])
        m.observe(0,[t])
        with self.assertRaises(ValueError):m.observe(0,[t])
        with self.assertRaises(ValueError):m.observe(-1,[])

    def test_empty_metrics(self):
        self.assertEqual(TrackingMetrics().summary()['continuous_runs'],0)

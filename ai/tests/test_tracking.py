import json
import unittest

from sevenmetros_ai.schema import frame_payload
from sevenmetros_ai.tracking import CentroidTracker, Detection


class TrackingTests(unittest.TestCase):
    def test_id_persists_for_small_motion(self):
        tracker = CentroidTracker(max_distance=30, max_missed=1)
        first = tracker.update([Detection(0, 0, 20, 40)])
        second = tracker.update([Detection(5, 1, 25, 41)])
        self.assertEqual(first[0].track_id, second[0].track_id)
        self.assertEqual(second[0].age, 2)

    def test_far_detection_gets_new_id(self):
        tracker = CentroidTracker(max_distance=10, max_missed=1)
        first = tracker.update([Detection(0, 0, 10, 10)])
        second = tracker.update([Detection(100, 100, 110, 110)])
        self.assertNotEqual(first[0].track_id, second[0].track_id)

    def test_track_survives_one_missing_frame(self):
        tracker = CentroidTracker(max_distance=30, max_missed=1)
        first = tracker.update([Detection(0, 0, 20, 40)])
        self.assertEqual(tracker.update([]), [])
        third = tracker.update([Detection(2, 0, 22, 40)])
        self.assertEqual(first[0].track_id, third[0].track_id)

    def test_frame_payload_contract(self):
        tracker = CentroidTracker()
        tracks = tracker.update([Detection(1, 2, 11, 22, confidence=0.91)])
        payload = frame_payload(frame_index=3, timestamp_ms=120.0, width=1920, height=1080, tracks=tracks)
        self.assertEqual(payload["schema"], "7metros-ai.v1")
        self.assertEqual(payload["objects"][0]["track_id"], 1)
        self.assertEqual(payload["objects"][0]["kind"], "player")
        json.dumps(payload)


if __name__ == "__main__":
    unittest.main()

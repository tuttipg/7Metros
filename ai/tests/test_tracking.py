import json
import unittest

from sevenmetros_ai.schema import frame_payload
from sevenmetros_ai.tracking import CentroidTracker, Detection, bbox_iou


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

    def test_velocity_prediction_handles_fast_motion(self):
        tracker = CentroidTracker(max_distance=15, max_missed=1)
        first = tracker.update([Detection(0, 0, 10, 10)])
        second = tracker.update([Detection(10, 0, 20, 10)])
        third = tracker.update([Detection(30, 0, 40, 10)])
        self.assertEqual(first[0].track_id, second[0].track_id)
        self.assertEqual(second[0].track_id, third[0].track_id)
        self.assertEqual(third[0].velocity_x, 20.0)
        self.assertEqual(third[0].velocity_y, 0.0)

    def test_team_gating_prevents_id_swap_at_crossing(self):
        tracker = CentroidTracker(max_distance=30, max_missed=1)
        first = tracker.update([
            Detection(0, 0, 10, 20, team="local"),
            Detection(40, 0, 50, 20, team="visitor"),
        ])
        local_id = first[0].track_id
        visitor_id = first[1].track_id

        tracker.update([
            Detection(15, 0, 25, 20, team="local"),
            Detection(25, 0, 35, 20, team="visitor"),
        ])
        crossed = tracker.update([
            Detection(30, 0, 40, 20, team="local"),
            Detection(10, 0, 20, 20, team="visitor"),
        ])

        by_team = {track.detection.team: track.track_id for track in crossed}
        self.assertEqual(by_team["local"], local_id)
        self.assertEqual(by_team["visitor"], visitor_id)

    def test_label_gating_prevents_ball_from_stealing_player_track(self):
        tracker = CentroidTracker(max_distance=20, max_missed=1)
        first = tracker.update([Detection(0, 0, 10, 20, label="player")])
        player_id = first[0].track_id
        second = tracker.update([Detection(2, 2, 6, 6, label="ball")])
        self.assertNotEqual(second[0].track_id, player_id)
        self.assertEqual(second[0].detection.label, "ball")

    def test_bbox_iou(self):
        self.assertAlmostEqual(
            bbox_iou(Detection(0, 0, 10, 10), Detection(5, 0, 15, 10)),
            1 / 3,
        )
        self.assertEqual(
            bbox_iou(Detection(0, 0, 10, 10), Detection(20, 20, 30, 30)),
            0.0,
        )

    def test_frame_payload_contract(self):
        tracker = CentroidTracker()
        tracker.update([Detection(1, 2, 11, 22, confidence=0.91)])
        tracks = tracker.update([Detection(4, 2, 14, 22, confidence=0.92)])
        payload = frame_payload(frame_index=3, timestamp_ms=120.0, width=1920, height=1080, tracks=tracks)
        self.assertEqual(payload["schema"], "7metros-ai.v1")
        self.assertEqual(payload["objects"][0]["track_id"], 1)
        self.assertEqual(payload["objects"][0]["kind"], "player")
        self.assertEqual(payload["objects"][0]["velocity_xy"], [3.0, 0.0])
        json.dumps(payload)


if __name__ == "__main__":
    unittest.main()

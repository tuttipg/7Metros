import unittest

from benchmark_ball_scene_guard import gate_predictions


class BallSceneGuardTests(unittest.TestCase):
    def test_rejects_boxes_without_court_and_keeps_court_boxes(self):
        predictions = {
            1: [{"bbox_xyxy": [1, 2, 3, 4]}],
            2: [{"bbox_xyxy": [5, 6, 7, 8]}],
        }
        retained, decisions = gate_predictions(
            predictions, {1: .65, 2: .10}, min_fraction=.15,
        )
        self.assertEqual(retained[1], predictions[1])
        self.assertEqual(retained[2], [])
        self.assertTrue(decisions[0]["court_present"])
        self.assertFalse(decisions[1]["court_present"])

    def test_rejects_invalid_threshold(self):
        with self.assertRaises(ValueError):
            gate_predictions({}, {}, min_fraction=0)


if __name__ == "__main__":
    unittest.main()

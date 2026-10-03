import unittest

from benchmark_ball_temporal_ground_truth import (
    evaluate_visible_sequences,
    is_non_regressive,
    replay_sequence,
)
from sevenmetros_ai.tracking import Detection


def ball(x, confidence):
    return Detection(x, 10, x + 10, 20, confidence=confidence, label="ball")


class TemporalBallGroundTruthBenchmarkTests(unittest.TestCase):
    def test_bridge_selects_returning_true_box_without_interpolation(self):
        rows = {
            0: [ball(0, .2)],
            1: [ball(300, .2)],
            2: [ball(300, .2)],
            3: [ball(300, .2)],
            4: [ball(300, .2)],
            5: [ball(25, .2), ball(500, .3)],
        }
        fractions = {frame: .6 for frame in rows}
        _, _, temporal, decisions = replay_sequence(
            rows, fractions, max_missed=4, high_threshold=.05,
        )
        self.assertEqual(temporal[1], [])
        self.assertEqual(temporal[4], [])
        self.assertEqual(temporal[5][0]["bbox_xyxy"], [25.0, 10.0, 35.0, 20.0])
        self.assertEqual(sum(row["temporal_candidates"] for row in decisions), 2)

    def test_scene_guard_prevents_false_track_spawn(self):
        rows = {0: [ball(100, .8)], 1: [ball(105, .7)]}
        fractions = {0: .05, 1: .05}
        _, guarded, temporal, _ = replay_sequence(rows, fractions)
        self.assertEqual(guarded, {0: [], 1: []})
        self.assertEqual(temporal, {0: [], 1: []})

    def test_reports_each_positive_sequence_but_skips_negative_only_control(self):
        documents = [
            {
                "sequence": {"name": "flight"},
                "annotations": [
                    {"frame_index": 1, "state": "visible", "bbox_xyxy": [0, 0, 10, 10]},
                ],
            },
            {
                "sequence": {"name": "negative"},
                "annotations": [
                    {"frame_index": 2, "state": "out_of_frame", "bbox_xyxy": None},
                ],
            },
        ]
        results = evaluate_visible_sequences(documents, {
            "candidate": {1: [{"bbox_xyxy": [0, 0, 10, 10]}]},
        })
        self.assertEqual(list(results), ["flight"])
        self.assertEqual(results["flight"]["candidate"]["matched"], 1)

    def test_non_regression_rejects_local_false_positive_increase(self):
        control = {
            "matched": 1,
            "false_negatives_on_visible_frames": 0,
            "false_positive_candidates_on_evaluable_frames": 0,
            "longest_consecutive_visible_miss_run": 0,
        }
        candidate = dict(control, false_positive_candidates_on_evaluable_frames=1)
        self.assertFalse(is_non_regressive(candidate, control))
        self.assertTrue(is_non_regressive(control, control))

    def test_duplicate_visible_sequence_name_is_rejected(self):
        document = {
            "sequence": {"name": "flight"},
            "annotations": [
                {"frame_index": 1, "state": "visible", "bbox_xyxy": [0, 0, 10, 10]},
            ],
        }
        with self.assertRaisesRegex(ValueError, "duplicate visible sequence name"):
            evaluate_visible_sequences([document, document], {"candidate": {}})


if __name__ == "__main__":
    unittest.main()

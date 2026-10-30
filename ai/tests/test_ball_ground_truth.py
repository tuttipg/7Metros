import copy
import unittest

from sevenmetros_ai.ball_ground_truth import (
    evaluate_ball_ground_truth,
    evaluate_visible_ball_frames,
    validate_ball_ground_truth,
)


def sample_document():
    return {
        "schema_version": "sevenmetros.ball-gt/v1",
        "source": {"video_sha256": "a" * 64, "width": 936, "height": 524},
        "sequence": {"name": "goal", "start_frame": 10, "end_frame_exclusive": 12},
        "annotations": [
            {"frame_index": 10, "state": "ambiguous", "bbox_xyxy": None,
             "note": "motion blur prevents localisation"},
            {"frame_index": 11, "state": "occluded", "bbox_xyxy": None,
             "note": "ball is behind the player"},
        ],
    }


class BallGroundTruthTests(unittest.TestCase):
    def test_uncertain_frames_are_not_counted_as_visible_or_negative(self):
        summary = validate_ball_ground_truth(sample_document())
        self.assertEqual(summary.total_frames, 2)
        self.assertEqual(summary.visible_frames, 0)
        self.assertFalse(summary.evaluable_localisation)
        self.assertEqual(summary.state_counts["ambiguous"], 1)

    def test_visible_frame_requires_valid_box(self):
        document = sample_document()
        document["annotations"][0].update(state="visible", bbox_xyxy=[10, 20, 16, 27], note="")
        summary = validate_ball_ground_truth(document)
        self.assertEqual(summary.visible_frames, 1)
        self.assertAlmostEqual(summary.visibility_fraction, .5)

    def test_rejects_visible_frame_without_box(self):
        document = sample_document()
        document["annotations"][0]["state"] = "visible"
        with self.assertRaisesRegex(ValueError, "requires bbox"):
            validate_ball_ground_truth(document)

    def test_rejects_box_on_ambiguous_frame(self):
        document = sample_document()
        document["annotations"][0]["bbox_xyxy"] = [10, 20, 16, 27]
        with self.assertRaisesRegex(ValueError, "only visible"):
            validate_ball_ground_truth(document)

    def test_rejects_incomplete_or_reordered_sequence(self):
        document = sample_document()
        document["annotations"] = list(reversed(document["annotations"]))
        with self.assertRaisesRegex(ValueError, "exactly once and in order"):
            validate_ball_ground_truth(document)

    def test_rejects_out_of_bounds_box(self):
        document = sample_document()
        document["annotations"][0].update(state="visible", bbox_xyxy=[930, 500, 950, 530])
        with self.assertRaisesRegex(ValueError, "outside"):
            validate_ball_ground_truth(document)

    def test_rejects_missing_review_note(self):
        document = copy.deepcopy(sample_document())
        document["annotations"][0]["note"] = ""
        with self.assertRaisesRegex(ValueError, "requires a review note"):
            validate_ball_ground_truth(document)

    def test_evaluation_ignores_ambiguous_frames(self):
        rows = [
            {"frame_index": 1, "state": "visible", "bbox_xyxy": [10, 10, 20, 20]},
            {"frame_index": 2, "state": "ambiguous", "bbox_xyxy": None},
        ]
        predictions = {
            1: [{"bbox_xyxy": [10, 10, 20, 20]}],
            2: [{"bbox_xyxy": [100, 100, 120, 120]}],
        }
        result = evaluate_visible_ball_frames(rows, predictions)
        self.assertEqual(result["visible_gt_frames"], 1)
        self.assertEqual(result["matched"], 1)
        self.assertEqual(result["false_positives_on_visible_frames"], 0)

    def test_evaluation_counts_unmatched_candidates_and_missing_ball(self):
        rows = [
            {"frame_index": 1, "state": "visible", "bbox_xyxy": [10, 10, 20, 20]},
            {"frame_index": 2, "state": "visible", "bbox_xyxy": [30, 30, 40, 40]},
        ]
        predictions = {1: [
            {"bbox_xyxy": [10, 10, 20, 20]},
            {"bbox_xyxy": [100, 100, 120, 120]},
        ]}
        result = evaluate_visible_ball_frames(rows, predictions)
        self.assertEqual(result["matched"], 1)
        self.assertEqual(result["false_negatives_on_visible_frames"], 1)
        self.assertEqual(result["false_positives_on_visible_frames"], 1)
        self.assertEqual(result["false_positive_candidates_on_evaluable_frames"], 1)
        self.assertEqual(result["visible_miss_runs"], [
            {"start_frame": 2, "end_frame": 2, "length": 1},
        ])
        self.assertEqual(result["longest_consecutive_visible_miss_run"], 1)

    def test_visible_miss_runs_split_on_matches_and_frame_gaps(self):
        rows = [
            {"frame_index": frame, "state": "visible", "bbox_xyxy": [10, 10, 20, 20]}
            for frame in (10, 11, 12, 20, 21)
        ]
        predictions = {12: [{"bbox_xyxy": [10, 10, 20, 20]}]}
        result = evaluate_ball_ground_truth(rows, predictions)
        self.assertEqual(result["visible_miss_runs"], [
            {"start_frame": 10, "end_frame": 11, "length": 2},
            {"start_frame": 20, "end_frame": 21, "length": 2},
        ])
        self.assertEqual(result["longest_consecutive_visible_miss_run"], 2)

    def test_evaluation_requires_visible_ground_truth(self):
        with self.assertRaisesRegex(ValueError, "no visible"):
            evaluate_visible_ball_frames(sample_document()["annotations"], {})

    def test_out_of_frame_candidates_are_false_positives(self):
        rows = [
            {"frame_index": 1, "state": "visible", "bbox_xyxy": [10, 10, 20, 20]},
            {"frame_index": 2, "state": "out_of_frame", "bbox_xyxy": None},
            {"frame_index": 3, "state": "occluded", "bbox_xyxy": None},
        ]
        predictions = {
            1: [{"bbox_xyxy": [10, 10, 20, 20]}],
            2: [{"bbox_xyxy": [100, 100, 120, 120]}],
            3: [{"bbox_xyxy": [100, 100, 120, 120]}],
        }
        result = evaluate_ball_ground_truth(rows, predictions)
        self.assertEqual(result["out_of_frame_negative_frames"], 1)
        self.assertEqual(result["negative_frames_with_candidates"], 1)
        self.assertEqual(result["false_positives_on_visible_frames"], 0)
        self.assertAlmostEqual(result["precision_on_reviewed_positive_frames"], 1.0)
        self.assertAlmostEqual(result["precision_on_reviewed_evaluable_frames"], .5)


if __name__ == "__main__":
    unittest.main()

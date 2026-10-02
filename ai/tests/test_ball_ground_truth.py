import copy
import unittest

from sevenmetros_ai.ball_ground_truth import validate_ball_ground_truth


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


if __name__ == "__main__":
    unittest.main()

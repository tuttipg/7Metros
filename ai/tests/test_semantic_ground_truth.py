import unittest

from sevenmetros_ai.semantic_ground_truth import (
    SCHEMA,
    score_events,
    score_possession,
    validate_semantic_gt,
)

VIDEO = "a" * 64


def document():
    return {
        "schema_version": SCHEMA,
        "status": "HUMAN_REVIEW_COMPLETE",
        "source": {"video_sha256": VIDEO},
        "sequence": {"start_frame": 10, "end_frame_exclusive": 14},
        "frames": [
            {"frame_index": 10, "ball_state": "visible", "possession_state": "controlled", "possessor_ref": "p1"},
            {"frame_index": 11, "ball_state": "visible", "possession_state": "free", "possessor_ref": None},
            {"frame_index": 12, "ball_state": "visible", "possession_state": "controlled", "possessor_ref": "p2"},
            {"frame_index": 13, "ball_state": "out_of_frame", "possession_state": "unknown", "possessor_ref": None},
        ],
        "events": [{"frame_index": 12, "kind": "same_team_control_change"}],
    }


class SemanticGroundTruthTests(unittest.TestCase):
    def test_validates_complete_sequence(self):
        gt = validate_semantic_gt(document())
        self.assertEqual(gt.start_frame, 10)
        self.assertEqual(len(gt.frames), 4)

    def test_rejects_missing_control_owner(self):
        d = document()
        d["frames"][0]["possessor_ref"] = None
        with self.assertRaisesRegex(ValueError, "requires possessor_ref"):
            validate_semantic_gt(d)

    def test_rejects_controlled_when_ball_is_not_visible(self):
        d = document()
        d["frames"][0]["ball_state"] = "occluded"
        with self.assertRaisesRegex(ValueError, "requires visible ball"):
            validate_semantic_gt(d)

    def test_rejects_out_of_frame_with_possession(self):
        d = document()
        d["frames"][3]["possession_state"] = "free"
        with self.assertRaisesRegex(ValueError, "out_of_frame ball requires unknown possession"):
            validate_semantic_gt(d)

    def test_possession_scoring(self):
        gt = validate_semantic_gt(document())
        result = score_possession(gt, [
            {"frame_index": 10, "possession_state": "controlled", "possessor_ref": "p1"},
            {"frame_index": 11, "possession_state": "free", "possessor_ref": None},
            {"frame_index": 12, "possession_state": "controlled", "possessor_ref": "wrong"},
            {"frame_index": 13, "possession_state": "controlled", "possessor_ref": "p2"},
        ])
        self.assertEqual((result["tp"], result["fp"], result["fn"]), (2, 1, 0))
        self.assertEqual(result["controlled_identity_correct"], 1)
        self.assertEqual(result["controlled_identity_accuracy"], 0.5)

    def test_event_scoring_uses_fixed_tolerance(self):
        gt = validate_semantic_gt(document())
        result = score_events(
            gt,
            [{"frame_index": 13, "kind": "same_team_control_change"}],
            tolerance_frames=1,
        )
        self.assertEqual((result["tp"], result["fp"], result["fn"]), (1, 0, 0))

    def test_event_kind_mismatch_is_not_a_match(self):
        gt = validate_semantic_gt(document())
        result = score_events(
            gt,
            [{"frame_index": 12, "kind": "opponent_control_change"}],
            tolerance_frames=2,
        )
        self.assertEqual((result["tp"], result["fp"], result["fn"]), (0, 1, 1))


if __name__ == "__main__":
    unittest.main()

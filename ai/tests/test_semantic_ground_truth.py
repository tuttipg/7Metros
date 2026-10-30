import unittest
from pathlib import Path

from sevenmetros_ai.semantic_ground_truth import (
    SCHEMA,
    load_semantic_gt,
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

    def test_zero_true_positives_returns_zero_f1(self):
        gt = validate_semantic_gt(document())
        pred = [
            {"frame_index": 10, "possession_state": "unknown"},
            {"frame_index": 11, "possession_state": "controlled", "possessor_ref": "wrong"},
            {"frame_index": 12, "possession_state": "unknown"},
            {"frame_index": 13, "possession_state": "unknown"},
        ]
        result = score_possession(gt, pred)
        self.assertEqual((result["tp"], result["fp"], result["fn"]), (0, 1, 2))
        self.assertEqual((result["precision"], result["recall"], result["f1"]), (0, 0, 0))

    def test_event_kind_mismatch_is_not_a_match(self):
        gt = validate_semantic_gt(document())
        result = score_events(
            gt,
            [{"frame_index": 12, "kind": "opponent_control_change"}],
            tolerance_frames=2,
        )
        self.assertEqual((result["tp"], result["fp"], result["fn"]), (0, 1, 1))
        self.assertEqual(result["f1"], 0)


    def test_loads_confirmed_nested_pilot_fixture(self):
        path = (
            Path(__file__).resolve().parents[1]
            / "evidence"
            / "semantic"
            / "ferro_lujan_semantic_pilot_145_164_2026-10-06.json"
        )
        gt = load_semantic_gt(path)
        self.assertEqual((gt.start_frame, gt.end_frame_exclusive), (145, 165))
        self.assertEqual(len(gt.frames), 20)
        self.assertEqual(len(gt.events), 1)
        self.assertEqual(gt.events[0]["frame_index"], 164)
        self.assertEqual(gt.events[0]["kind"], "same_team_control_change")
        self.assertEqual(gt.status, "HUMAN_REVIEW_COMPLETE")

    def test_rejects_unconfirmed_nested_labels(self):
        d = document()
        d["proposed_labels_for_human_confirmation"] = {
            "frames": d.pop("frames"),
            "events": d.pop("events"),
        }
        d["human_review"] = {"status": "PENDING"}
        with self.assertRaisesRegex(ValueError, "human_review.status CONFIRMED"):
            validate_semantic_gt(d)

    def test_rejects_nested_labels_when_document_status_is_not_complete(self):
        d = document()
        d["proposed_labels_for_human_confirmation"] = {
            "frames": d.pop("frames"),
            "events": d.pop("events"),
        }
        d["human_review"] = {"status": "CONFIRMED"}
        d["status"] = "DRAFT"
        with self.assertRaisesRegex(ValueError, "HUMAN_REVIEW_COMPLETE"):
            validate_semantic_gt(d)

    def test_rejects_partial_top_level_frame_event_pair(self):
        d = document()
        d.pop("events")
        with self.assertRaisesRegex(ValueError, "frames and events must be supplied together"):
            validate_semantic_gt(d)

if __name__ == "__main__":
    unittest.main()

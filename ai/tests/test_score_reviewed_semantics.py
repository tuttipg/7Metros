import unittest
from score_reviewed_semantics import score_pilot, score_ball_counts, replay_as_predictions

def examples():
    gt = {"schema_version":"sevenmetros.semantic-gt/v1","status":"HUMAN_REVIEW_COMPLETE",
          "human_review":{"status":"CONFIRMED"},"source":{"video_sha256":"a"*64},
          "sequence":{"start_frame":145,"end_frame_exclusive":165},
          "existing_ground_truth":{"candidate_event":{"frame_index":151,"kind":"opponent_control_change_candidate"}},
          "proposed_labels_for_human_confirmation":{
              "frames":[{"frame_index":i,"ball_state":"visible",
                         "possession_state":"controlled" if i in (145,164) else "free",
                         "possessor_ref":("player_gt_1" if i==145 else "player_gt_8") if i in (145,164) else None}
                        for i in range(145,165)],
              "events":[{"frame_index":164,"kind":"same_team_control_change"}]}}
    pred={"status":"UNVERIFIED_CONTROL_CHANGE_CANDIDATES_NO_EVENT_GT","fixture_frames":[105,210],
          "events":[{"frame_index":151,"kind":"opponent_control_change_candidate"}]}
    return gt,pred

class ReviewedEvidenceTests(unittest.TestCase):
    def test_real_type_disagreement_is_not_true_positive(self):
        gt,p=examples()
        r=score_pilot(gt,p)
        self.assertEqual(tuple(r["control_change"][k] for k in ("tp","fp","fn")),(0,1,1))
        self.assertEqual(r["control_change"]["f1"],0)
        self.assertIsNone(r["possession"])
    def test_unconfirmed_gt_rejected(self):
        gt,p=examples();gt["human_review"]["status"]="PENDING"
        with self.assertRaises(ValueError):score_pilot(gt,p)
    def test_changed_candidate_reference_rejected(self):
        gt,p=examples();p["events"][0]["frame_index"]=152
        with self.assertRaises(ValueError):score_pilot(gt,p)
    def test_partial_possession_rejected(self):
        gt,p=examples()
        with self.assertRaises(ValueError):score_pilot(gt,p,[{"frame_index":145,"possession_state":"unknown"}])
    def test_complete_possession_scored_only_when_supplied(self):
        gt,p=examples()
        pred=[{"frame_index":i,"possession_state":"unknown","possessor_ref":None} for i in range(145,165)]
        pred[0].update(possession_state="controlled",possessor_ref="player_gt_1")
        r=score_pilot(gt,p,pred)
        self.assertEqual((r["possession"]["tp"],r["possession"]["fn"]),(1,1))
    def test_real_possession_replay_is_scored_without_owner_identity_claim(self):
        from pathlib import Path
        import json
        root=Path(__file__).resolve().parents[2]
        gt=json.loads((root/'ai/evidence/semantic/ferro_lujan_semantic_pilot_145_164_2026-10-06.json').read_text())
        replay=json.loads((root/'ai/evidence/semantic/possession_replay_145_164_2026-10-29.json').read_text())
        events=json.loads((root/'ai/evidence/ball/event_candidates_gt1_2026-10-01.json').read_text())
        predictions=replay_as_predictions(gt,replay)
        scored=score_pilot(gt,events,predictions)
        self.assertEqual((scored['possession']['tp'],scored['possession']['fp'],scored['possession']['fn']),(0,8,4))
        self.assertEqual(scored['possession']['f1'],0)
        self.assertNotIn('controlled_identity_accuracy',scored['possession'])

    def test_replay_rejects_bad_source_video(self):
        from pathlib import Path
        import json
        root=Path(__file__).resolve().parents[2]
        gt=json.loads((root/'ai/evidence/semantic/ferro_lujan_semantic_pilot_145_164_2026-10-06.json').read_text())
        replay=json.loads((root/'ai/evidence/semantic/possession_replay_145_164_2026-10-29.json').read_text())
        replay['source']['original_video_sha256']='0'*64
        with self.assertRaisesRegex(ValueError,'source video hash mismatch'):
            replay_as_predictions(gt,replay)

    def test_ball_f1_recomputed_from_counts(self):
        b={"schema":"sevenmetros.ball-model-heldout-comparison/v1",
           "evaluation_scope":{"visible_gt_frames":53,"out_of_frame_negative_frames":60,"iou_threshold":0.5}}
        a={"strong_control":(24,3),"court_guard_plus_two_stage_association":(33,1)}
        s={"strong_control":(15,76),"court_guard_plus_two_stage_association":(16,29)}
        for key,pairs in (("generic_yolo11n_coco_sports_ball",a),("specialized_handball_yolo11n_e5",s)):
            b[key]={"model_sha256":"b"*64}
            for v,(tp,fp) in pairs.items():
                b[key][v]={"matched":tp,"false_positive_candidates":fp,
                           "reviewed_evaluable_precision":tp/(tp+fp),"reviewed_positive_recall":tp/53}
        r=score_ball_counts(b)["models"]["generic_yolo11n_coco_sports_ball"]["variants"]["court_guard_plus_two_stage_association"]
        self.assertEqual(tuple(r[k] for k in ("tp","fp","fn")),(33,1,20))
        self.assertAlmostEqual(r["f1"],66/87)

if __name__=="__main__":
    unittest.main()


class CommittedEvidenceRegressionTests(unittest.TestCase):
    def test_real_confirmed_pilot_and_ball_counts(self):
        import json
        from pathlib import Path
        root = Path(__file__).resolve().parents[2]
        gt = json.loads((root / "ai/evidence/semantic/ferro_lujan_semantic_pilot_145_164_2026-10-06.json").read_text())
        events = json.loads((root / "ai/evidence/ball/event_candidates_gt1_2026-10-01.json").read_text())
        ball = json.loads((root / "ai/evidence/ball/handball_v2_yolo11n_e5_comparison_2026-10-03.json").read_text())
        scored = score_pilot(gt, events)
        c = scored["control_change"]
        self.assertEqual((c["tp"], c["fp"], c["fn"]), (0, 1, 1))
        self.assertEqual((c["precision"], c["recall"], c["f1"]), (0, 0, 0))
        self.assertIsNone(scored["possession"])
        b = score_ball_counts(ball)
        s = b["models"]["generic_yolo11n_coco_sports_ball"]["variants"]["court_guard_plus_two_stage_association"]
        self.assertEqual((s["tp"], s["fp"], s["fn"]), (33, 1, 20))
        self.assertAlmostEqual(s["f1"], 66/87)
        kept = json.loads((root / "ai/evidence/semantic/reviewed_scoring_2026-10-29.json").read_text())
        self.assertEqual(kept["control_change"]["f1"], c["f1"])
        self.assertEqual(kept["ball_sample"]["models"]["generic_yolo11n_coco_sports_ball"]["variants"]["court_guard_plus_two_stage_association"], s)

"""Strict reviewed-pilot evaluation. No unreviewed GT or inferred missing predictions."""
import argparse
import hashlib
import json
from pathlib import Path
from sevenmetros_ai.semantic_ground_truth import validate_semantic_gt, score_events, score_possession

KINDS = {"opponent_control_change_candidate": "opponent_control_change",
         "same_team_control_change_candidate": "same_team_control_change"}

def prf(tp, fp, fn):
    return {"tp": tp, "fp": fp, "fn": fn,
            "precision": tp / (tp + fp) if tp + fp else None,
            "recall": tp / (tp + fn) if tp + fn else None,
            "f1": 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else None}

def score_pilot(document, candidate_evidence, predictions=None):
    if document.get("status") != "HUMAN_REVIEW_COMPLETE" or document.get("human_review", {}).get("status") != "CONFIRMED":
        raise ValueError("human GT not confirmed")
    gt = validate_semantic_gt(document)
    if candidate_evidence.get("status") != "UNVERIFIED_CONTROL_CHANGE_CANDIDATES_NO_EVENT_GT":
        raise ValueError("unexpected candidate evidence")
    window = candidate_evidence.get("fixture_frames")
    if not isinstance(window, list) or len(window) != 2 or window[0] > gt.start_frame or window[1] < gt.end_frame_exclusive:
        raise ValueError("event evidence does not cover GT")
    expected = document.get("existing_ground_truth", {}).get("candidate_event", {})
    originals = candidate_evidence.get("events")
    if not isinstance(originals, list) or not any(
        row.get("frame_index") == expected.get("frame_index") and row.get("kind") == expected.get("kind")
        for row in originals
    ):
        raise ValueError("original event candidate does not match GT reference")
    events = []
    seen = set()
    for row in originals:
        f, kind = row.get("frame_index"), KINDS.get(row.get("kind"))
        if type(f) is not int or kind is None or f in seen:
            raise ValueError("invalid or duplicate candidate event")
        seen.add(f)
        if gt.start_frame <= f < gt.end_frame_exclusive:
            events.append({"frame_index": f, "kind": kind})
    ev = score_events(gt, events, tolerance_frames=2)
    possession = None
    if predictions is not None:
        if [r.get("frame_index") for r in predictions] != list(range(gt.start_frame, gt.end_frame_exclusive)):
            raise ValueError("possession predictions require complete ordered GT window")
        if any(r.get("possession_state") not in ("controlled", "free", "unassigned", "ambiguous", "unknown") for r in predictions):
            raise ValueError("invalid prediction state")
        possession = score_possession(gt, predictions)
        # Raw tracker IDs are not human GT identities. Report only the state-level score.
        possession.pop("controlled_identity_correct", None)
        possession.pop("controlled_identity_accuracy", None)
        possession["note"] = "controlled-vs-not only; owner identity NOT scored"
    return {"schema_version": "sevenmetros.reviewed-scoring/v1", "status": "REVIEWED_PILOT_ONLY",
            "sequence": {"start_frame": gt.start_frame, "end_frame_exclusive": gt.end_frame_exclusive,
                         "video_sha256": gt.video_sha256},
            "control_change": {**prf(ev["tp"], ev["fp"], ev["fn"]),
                               "gt_events": len(gt.events), "predicted_events": len(events),
                               "tolerance_frames": 2, "matches": ev["matches"]},
            "possession": possession,
            "possession_note": None if possession is not None else "No retained source-matched, per-frame possession prediction stream.",
            "full_match_generalization": False}

def score_ball_counts(comparison):
    if comparison.get("schema") != "sevenmetros.ball-model-heldout-comparison/v1":
        raise ValueError("unsupported ball evidence schema")
    scope = comparison["evaluation_scope"]
    positives, negatives = scope["visible_gt_frames"], scope["out_of_frame_negative_frames"]
    if type(positives) is not int or type(negatives) is not int or positives <= 0 or negatives < 0:
        raise ValueError("invalid evaluated counts")
    models = {}
    for name in ("generic_yolo11n_coco_sports_ball", "specialized_handball_yolo11n_e5"):
        source = comparison[name]
        variants = {}
        for v in ("strong_control", "court_guard_plus_two_stage_association"):
            row = source[v]
            tp, fp = row["matched"], row["false_positive_candidates"]
            if type(tp) is not int or type(fp) is not int or not 0 <= tp <= positives or fp < 0:
                raise ValueError("invalid retained TP or FP counts")
            stats = prf(tp, fp, positives - tp)
            if abs(stats["precision"] - row["reviewed_evaluable_precision"]) > 1e-10 or abs(stats["recall"] - row["reviewed_positive_recall"]) > 1e-10:
                raise ValueError("retained metrics disagree with counts")
            variants[v] = stats
        models[name] = {"model_sha256": source["model_sha256"], "variants": variants}
    return {"status": "RECOMPUTED_FROM_RETAINED_COUNTS_NOT_FRESH_INFERENCE",
            "visible_gt_frames": positives, "out_of_frame_negative_frames": negatives,
            "iou_threshold": scope["iou_threshold"], "models": models,
            "full_match_generalization": False}

def replay_as_predictions(gt_doc, replay):
    """Require verified source and full frame coverage before scoring POS? replay."""
    if replay.get("schema") != "sevenmetros.possession-pilot-replay/v1":
        raise ValueError("invalid possession replay schema")
    source, sequence = replay.get("source", {}), replay.get("sequence", {})
    gt_sequence = gt_doc.get("sequence", {})
    if source.get("original_video_sha256") != gt_doc.get("source", {}).get("video_sha256"):
        raise ValueError("possession replay source video hash mismatch")
    if (sequence.get("start_frame"), sequence.get("end_frame_exclusive")) != (
        gt_sequence.get("start_frame"), gt_sequence.get("end_frame_exclusive")
    ):
        raise ValueError("possession replay range mismatch")
    if (source.get("original_source_start_frame") != gt_doc.get("source", {}).get("fixture_offset_frames")
            or source.get("pixel_identical_frames", -1) < sequence["end_frame_exclusive"]):
        raise ValueError("source-to-fixture pixel identity not established")
    rows = replay.get("predictions", [])
    if [r.get("frame_index") for r in rows] != list(range(sequence["start_frame"], sequence["end_frame_exclusive"])):
        raise ValueError("possession replay is not complete")
    states = {"candidate": "controlled", "observed_unassigned": "free",
              "observed_ambiguous": "ambiguous", "ball_unobserved": "unknown"}
    converted = []
    for row in rows:
        state = states.get(row.get("state"))
        if state is None:
            raise ValueError("unsupported raw possession state")
        if (state == "unknown") == bool(row.get("ball_observed")):
            raise ValueError("ball observation flag contradicts raw state")
        if state == "controlled" and (type(row.get("track_id")) is not int or row["track_id"] < 0):
            raise ValueError("controlled candidate requires valid tracker ID")
        converted.append({"frame_index": row["frame_index"], "possession_state": state,
                          "possessor_ref": "tracker_%s" % row["track_id"] if state == "controlled" else None})
    return converted


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gt", required=True)
    parser.add_argument("--candidate-evidence", required=True)
    parser.add_argument("--ball-comparison", required=True)
    parser.add_argument("--possession-replay")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    paths = [Path(args.gt), Path(args.candidate_evidence), Path(args.ball_comparison)]
    docs = [json.loads(p.read_text(encoding="utf-8")) for p in paths]
    replay_file = Path(args.possession_replay) if args.possession_replay else None
    predictions = replay_as_predictions(docs[0], json.loads(replay_file.read_text(encoding="utf-8"))) if replay_file else None
    report = score_pilot(docs[0], docs[1], predictions=predictions)
    if replay_file:
        report["input_sha256_possession_replay"] = hashlib.sha256(replay_file.read_bytes()).hexdigest()
    report["ball_sample"] = score_ball_counts(docs[2])
    report["input_sha256"] = {label: hashlib.sha256(p.read_bytes()).hexdigest()
                              for label, p in zip(("human_semantic_gt", "event_candidates", "ball_comparison"), paths)}
    Path(args.output).write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))

if __name__ == "__main__":
    main()

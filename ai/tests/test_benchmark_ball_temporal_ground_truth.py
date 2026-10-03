import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from benchmark_ball_temporal_ground_truth import (
    benchmark,
    build_ball_detection_cache,
    evaluate_visible_sequences,
    is_non_regressive,
    load_ball_detection_cache,
    replay_sequence,
)
from sevenmetros_ai.tracking import Detection


def ball(x, confidence):
    return Detection(x, 10, x + 10, 20, confidence=confidence, label="ball")


RUNTIME = {
    "python_version": "3.12.0",
    "opencv_version": "4.11.0",
    "ultralytics_version": "8.4.163",
    "torch_version": "2.14.0+cpu",
    "device": "cpu",
    "machine": "x86_64",
    "torch_num_threads": 4,
}


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

    def test_strict_cache_round_trip_preserves_detections_and_court_fraction(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            video, model, cache = root / "clip.mp4", root / "model.pt", root / "cache.json"
            video.write_bytes(b"video")
            model.write_bytes(b"model")
            documents = [{
                "sequence": {"name": "flight", "start_frame": 5, "end_frame_exclusive": 7},
            }]
            payload = build_ball_detection_cache(
                video,
                model,
                documents,
                {5: [ball(10, .2)], 6: []},
                {5: .6, 6: .7},
                low_threshold=.02,
                imgsz=960,
                inference_runtime=RUNTIME,
            )
            self.assertEqual(
                payload["schema_version"], "sevenmetros.ball-detection-cache/v2",
            )
            self.assertEqual(payload["inference_runtime"], RUNTIME)
            cache.write_text(json.dumps(payload), encoding="utf-8")
            rows, fractions = load_ball_detection_cache(
                cache,
                video=video,
                model=model,
                documents=documents,
                low_threshold=.02,
                imgsz=960,
            )
            self.assertEqual(rows[5][0].label, "ball")
            self.assertEqual([
                rows[5][0].x1, rows[5][0].y1, rows[5][0].x2, rows[5][0].y2,
            ], [10.0, 10.0, 20.0, 20.0])
            self.assertEqual(rows[6], [])
            self.assertEqual(fractions, {5: .6, 6: .7})

    def test_legacy_v1_cache_remains_replayable_without_runtime_imports(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            video, model, cache = root / "clip.mp4", root / "model.pt", root / "cache.json"
            video.write_bytes(b"video")
            model.write_bytes(b"model")
            documents = [{
                "sequence": {"name": "flight", "start_frame": 5, "end_frame_exclusive": 6},
            }]
            payload = build_ball_detection_cache(
                video, model, documents, {5: [ball(10, .2)]}, {5: .6},
                low_threshold=.02, imgsz=960, inference_runtime=RUNTIME,
            )
            payload["schema_version"] = "sevenmetros.ball-detection-cache/v1"
            payload.pop("inference_runtime")
            cache.write_text(json.dumps(payload), encoding="utf-8")
            rows, fractions = load_ball_detection_cache(
                cache, video=video, model=model, documents=documents,
                low_threshold=.02, imgsz=960,
            )
            self.assertEqual(rows[5][0].confidence, .2)
            self.assertEqual(fractions[5], .6)

    def test_v2_cache_rejects_missing_or_invalid_runtime_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            video, model, cache = root / "clip.mp4", root / "model.pt", root / "cache.json"
            video.write_bytes(b"video")
            model.write_bytes(b"model")
            documents = [{
                "sequence": {"name": "flight", "start_frame": 5, "end_frame_exclusive": 6},
            }]
            payload = build_ball_detection_cache(
                video, model, documents, {5: []}, {5: .6},
                low_threshold=.02, imgsz=960, inference_runtime=RUNTIME,
            )
            for provenance in (None, {**RUNTIME, "torch_num_threads": 0}):
                payload["inference_runtime"] = provenance
                cache.write_text(json.dumps(payload), encoding="utf-8")
                with self.subTest(provenance=provenance), self.assertRaisesRegex(
                    ValueError, "runtime",
                ):
                    load_ball_detection_cache(
                        cache, video=video, model=model, documents=documents,
                        low_threshold=.02, imgsz=960,
                    )

    def test_strict_cache_rejects_configuration_or_frame_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            video, model, cache = root / "clip.mp4", root / "model.pt", root / "cache.json"
            video.write_bytes(b"video")
            model.write_bytes(b"model")
            documents = [{
                "sequence": {"name": "flight", "start_frame": 5, "end_frame_exclusive": 7},
            }]
            payload = build_ball_detection_cache(
                video, model, documents, {5: [], 6: []}, {5: .6, 6: .7},
                low_threshold=.02, imgsz=960,
                inference_runtime=RUNTIME,
            )
            cache.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "configuration mismatch"):
                load_ball_detection_cache(
                    cache, video=video, model=model, documents=documents,
                    low_threshold=.03, imgsz=960,
                )
            with self.assertRaisesRegex(ValueError, "configuration mismatch"):
                load_ball_detection_cache(
                    cache, video=video, model=model, documents=documents,
                    low_threshold=.02, imgsz=960, class_id=0,
                )
            payload["frames"].pop()
            cache.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "incomplete, duplicated, or out of order"):
                load_ball_detection_cache(
                    cache, video=video, model=model, documents=documents,
                    low_threshold=.02, imgsz=960,
                )

    def test_cache_rejects_lossy_or_negative_class_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            video, model = root / "clip.mp4", root / "model.pt"
            video.write_bytes(b"video")
            model.write_bytes(b"model")
            documents = [{
                "sequence": {"name": "flight", "start_frame": 5, "end_frame_exclusive": 6},
            }]
            for class_id in (-1, 1.5, True, "0"):
                with self.subTest(class_id=class_id), self.assertRaises(ValueError):
                    build_ball_detection_cache(
                        video, model, documents, {5: []}, {5: .6},
                        low_threshold=.10, imgsz=640, class_id=class_id,
                        inference_runtime=RUNTIME,
                    )

    def test_benchmark_replays_cache_without_neural_inference(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            video, model = root / "clip.mp4", root / "model.pt"
            ground_truth, cache = root / "gt.json", root / "cache.json"
            video.write_bytes(b"video")
            model.write_bytes(b"model")
            document = {
                "schema_version": "sevenmetros.ball-gt/v1",
                "source": {
                    "video_sha256": hashlib.sha256(b"video").hexdigest(),
                    "width": 100,
                    "height": 100,
                },
                "sequence": {
                    "name": "flight", "start_frame": 0, "end_frame_exclusive": 2,
                },
                "annotations": [
                    {"frame_index": 0, "state": "visible", "bbox_xyxy": [10, 10, 20, 20]},
                    {"frame_index": 1, "state": "out_of_frame", "bbox_xyxy": None,
                     "note": "human-confirmed negative"},
                ],
            }
            ground_truth.write_text(json.dumps(document), encoding="utf-8")
            cache.write_text(json.dumps(build_ball_detection_cache(
                video,
                model,
                [document],
                {0: [ball(10, .2)], 1: []},
                {0: .6, 1: .6},
                low_threshold=.02,
                imgsz=960,
                inference_runtime=RUNTIME,
            )), encoding="utf-8")
            result = benchmark(
                video, model, [ground_truth], cache_input=cache,
            )
            self.assertEqual(
                result["processing"]["detector"],
                "STRICT_DETECTION_CACHE_REPLAY_NO_NEURAL_INFERENCE",
            )
            self.assertEqual(
                result["inputs"]["detection_cache"]["schema_version"],
                "sevenmetros.ball-detection-cache/v2",
            )
            self.assertEqual(
                result["inputs"]["detection_cache"]["inference_runtime"], RUNTIME,
            )
            self.assertEqual(result["blue_court_plus_temporal"]["matched"], 1)
            self.assertEqual(result["settings"]["ball_class_id"], 32)

    def test_cache_round_trip_supports_specialized_single_class_model(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            video, model, cache = root / "clip.mp4", root / "model.pt", root / "cache.json"
            video.write_bytes(b"video")
            model.write_bytes(b"specialized-model")
            documents = [{
                "sequence": {"name": "flight", "start_frame": 5, "end_frame_exclusive": 6},
            }]
            payload = build_ball_detection_cache(
                video, model, documents, {5: [ball(10, .2)]}, {5: .6},
                low_threshold=.10, imgsz=640, class_id=0,
                inference_runtime=RUNTIME,
            )
            cache.write_text(json.dumps(payload), encoding="utf-8")
            rows, _ = load_ball_detection_cache(
                cache, video=video, model=model, documents=documents,
                low_threshold=.10, imgsz=640, class_id=0,
            )
            self.assertEqual(payload["detector"]["class_id"], 0)
            self.assertEqual(rows[5][0].label, "ball")

    def test_cache_output_collision_fails_before_inference(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory) / "existing.json"
            cache.write_text("do not overwrite", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "already exists"):
                benchmark("missing.mp4", "missing.pt", [], cache_output=cache)
            self.assertEqual(cache.read_text(encoding="utf-8"), "do not overwrite")


if __name__ == "__main__":
    unittest.main()

import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import run_tracker_ab_experiment as experiment


def _row(frame, track_id):
    return {
        "schema": "7metros-ai.v1",
        "frame_index": frame,
        "timestamp_ms": frame * 10.0,
        "image": {"width": 100, "height": 50},
        "objects": [{
            "track_id": track_id,
            "kind": "player",
            "confidence": .9,
            "bbox_xyxy": [1, 1, 10, 20],
            "center_xy": [5.5, 10.5],
            "velocity_xy": [0, 0],
            "team": None,
        }],
    }


class TrackerABExperimentTests(unittest.TestCase):
    def fake_compare(self, video, cache, output_dir, **kwargs):
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        trackers = {}
        offset = 100 if kwargs.get("freeze_ambiguous_velocity") else 0
        for index, name in enumerate(experiment.TRACKER_NAMES, 1):
            path = output_dir / f"{name}.jsonl"
            with path.open("w", encoding="utf-8") as stream:
                for frame in range(4):
                    stream.write(json.dumps(_row(frame, offset + index)) + "\n")
            trackers[name] = {"output_jsonl": str(path)}
        (output_dir / "comparison.json").write_text(
            json.dumps({"trackers": trackers, "kwargs": kwargs}),
            encoding="utf-8",
        )
        return {"trackers": trackers}

    def inputs(self, root):
        video = root / "video.mp4"
        cache = root / "detections.jsonl"
        video.write_bytes(b"video")
        cache.write_text("[]\n", encoding="utf-8")
        cache.with_suffix(".meta.json").write_text(
            json.dumps({"confidence": .10}), encoding="utf-8"
        )
        return video, cache

    def test_runs_control_and_candidate_and_retains_requested_slice(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            video, cache = self.inputs(root)
            output = root / "out"
            with patch.object(
                experiment.benchmark_trackers, "compare", side_effect=self.fake_compare
            ) as mocked:
                result = experiment.run_experiment(
                    video, cache, output, ranges=((1, 3),), ambiguity_iou=.30
                )

            self.assertEqual(mocked.call_count, 2)
            self.assertFalse(
                mocked.call_args_list[0].kwargs["freeze_ambiguous_velocity"]
            )
            self.assertTrue(
                mocked.call_args_list[1].kwargs["freeze_ambiguous_velocity"]
            )
            self.assertEqual(
                result["settings"]["ranges_start_inclusive_end_exclusive"], [[1, 3]]
            )
            for run in result["runs"].values():
                self.assertTrue(Path(run["retained_manifest_path"]).is_file())
                for slices in run["retained_slices"].values():
                    self.assertEqual(slices[0]["frames"], 2)
            self.assertTrue(Path(result["manifest_path"]).is_file())

    def test_rejects_nonempty_output_before_running_benchmark(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            video, cache = self.inputs(root)
            output = root / "out"
            output.mkdir()
            (output / "old.txt").write_text("old", encoding="utf-8")
            with patch.object(experiment.benchmark_trackers, "compare") as mocked:
                with self.assertRaisesRegex(ValueError, "not empty"):
                    experiment.run_experiment(video, cache, output, ranges=((0, 1),))
            mocked.assert_not_called()

    def test_rejects_max_frames_that_cannot_cover_evidence_range(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            video, cache = self.inputs(root)
            with self.assertRaisesRegex(ValueError, "does not cover"):
                experiment.run_experiment(
                    video, cache, root / "out", ranges=((2, 4),), max_frames=3
                )


if __name__ == "__main__":
    unittest.main()

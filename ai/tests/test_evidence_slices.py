import json
import tempfile
import unittest
from pathlib import Path

from sevenmetros_ai.evidence_slices import parse_frame_range, retain_tracking_slices


def tracking_row(frame, ids):
    return {
        "schema": "7metros-ai.v1",
        "frame_index": frame,
        "timestamp_ms": frame * 33.333,
        "image": {"width": 100, "height": 80},
        "objects": [
            {
                "track_id": track_id,
                "kind": "player",
                "confidence": .8,
                "bbox_xyxy": [1, 2, 10, 20],
                "center_xy": [5.5, 11],
                "velocity_xy": [0, 0],
                "team": None,
            }
            for track_id in ids
        ],
    }


def write_jsonl(path, frames):
    with Path(path).open("w", encoding="utf-8") as stream:
        for frame, ids in frames:
            stream.write(json.dumps(tracking_row(frame, ids)) + "\n")


class EvidenceSliceTests(unittest.TestCase):
    def test_parse_frame_range(self):
        self.assertEqual(parse_frame_range("105:210"), (105, 210))
        for value in ("x:2", "2", "2:2", "3:2", "-1:2"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                parse_frame_range(value)

    def test_retain_two_trackers_and_preserve_original_frames(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            left = root / "left.jsonl"
            right = root / "right.jsonl"
            frames = [(i, [1, 2] if i % 2 == 0 else [1]) for i in range(8)]
            write_jsonl(left, frames)
            write_jsonl(right, frames)
            output = root / "retained"
            manifest = retain_tracking_slices(
                {"baseline": left, "two_stage": right}, [(2, 5), (6, 8)], output
            )
            self.assertEqual(manifest["ranges"], [[2, 5], [6, 8]])
            self.assertEqual(set(manifest["trackers"]), {"baseline", "two_stage"})
            saved = output / "baseline__frames_2_5.jsonl"
            rows = [json.loads(line) for line in saved.read_text().splitlines()]
            self.assertEqual([row["frame_index"] for row in rows], [2, 3, 4])
            self.assertEqual(manifest["trackers"]["baseline"]["slices"][0]["frames"], 3)
            self.assertTrue(manifest["trackers"]["baseline"]["slices"][0]["sha256"])
            self.assertTrue((output / "manifest.json").is_file())

    def test_missing_requested_frame_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "tracks.jsonl"
            write_jsonl(source, [(0, [1]), (2, [1])])
            with self.assertRaisesRegex(ValueError, "missing"):
                retain_tracking_slices({"baseline": source}, [(0, 3)], root / "out")

    def test_overlapping_ranges_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "tracks.jsonl"
            write_jsonl(source, [(i, [1]) for i in range(10)])
            with self.assertRaisesRegex(ValueError, "overlap"):
                retain_tracking_slices({"baseline": source}, [(1, 5), (4, 7)], root / "out")

    def test_nonempty_output_directory_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "tracks.jsonl"
            write_jsonl(source, [(i, [1]) for i in range(3)])
            output = root / "out"
            output.mkdir()
            (output / "existing.txt").write_text("keep")
            with self.assertRaisesRegex(ValueError, "not empty"):
                retain_tracking_slices({"baseline": source}, [(0, 2)], output)

    def test_unsafe_tracker_name_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "tracks.jsonl"
            write_jsonl(source, [(0, [1])])
            with self.assertRaisesRegex(ValueError, "Unsafe"):
                retain_tracking_slices({"../bad": source}, [(0, 1)], root / "out")


if __name__ == "__main__":
    unittest.main()

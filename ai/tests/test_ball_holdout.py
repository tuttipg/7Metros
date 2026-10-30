import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from sevenmetros_ai.ball_holdout import (
    build_holdout_manifest,
    build_perceptual_holdout_manifest,
    extract_pixel_hashes,
    load_cache_contract,
    pixel_sha256,
)


class FakeFrame:
    shape = (2, 2, 3)
    dtype = "uint8"
    def __init__(self, value=0, *, shape=None):
        if shape is not None:
            self.shape = shape
        size = 1
        for dimension in self.shape:
            size *= dimension
        self.pixels = bytes([value]) * size
    def tobytes(self, order="C"):
        if order != "C":
            raise ValueError("unexpected order")
        return self.pixels


class FakeCapture:
    def __init__(self, frames): self.frames, self.index, self.released = frames, 0, False
    def isOpened(self): return True
    def read(self):
        if self.index >= len(self.frames): return False, None
        frame = self.frames[self.index]
        self.index += 1
        return True, frame
    def release(self): self.released = True


class FakeCV2:
    __version__ = "test-opencv"
    def __init__(self, frames): self.capture = FakeCapture(frames)
    def VideoCapture(self, _): return self.capture


class BallHoldoutTests(unittest.TestCase):
    def files(self, root, indexes=(0, 2)):
        root = Path(root)
        video, cache = root / "fixture.mp4", root / "cache.json"
        video.write_bytes(b"video")
        cache.write_text(json.dumps({
            "schema_version": "sevenmetros.ball-detection-cache/v2",
            "source": {"video_sha256": hashlib.sha256(b"video").hexdigest()},
            "frames": [{"frame_index": index} for index in indexes],
        }), encoding="utf-8")
        return video, cache

    def test_pixel_hash_binds_shape_dtype_and_bytes(self):
        first = FakeFrame(0)
        changed = FakeFrame(1)
        self.assertNotEqual(pixel_sha256(first), pixel_sha256(changed))
        with self.assertRaisesRegex(ValueError, "HxWx3"):
            pixel_sha256(FakeFrame(0, shape=(2, 3)))

    def test_cache_contract_requires_exact_video_and_unique_frames(self):
        with tempfile.TemporaryDirectory() as root:
            video, cache = self.files(root)
            self.assertEqual(load_cache_contract(cache, video)["frame_indices"], [0, 2])
            video.write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "video SHA256"):
                load_cache_contract(cache, video)
        with tempfile.TemporaryDirectory() as root:
            video, cache = self.files(root, indexes=(2, 0))
            self.assertEqual(load_cache_contract(cache, video)["frame_indices"], [0, 2])
        with tempfile.TemporaryDirectory() as root:
            video, cache = self.files(root, indexes=(2, 2))
            with self.assertRaisesRegex(ValueError, "unique"):
                load_cache_contract(cache, video)

    def test_extracts_only_requested_frames_and_releases_video(self):
        frames = [FakeFrame(value) for value in range(3)]
        fake = FakeCV2(frames)
        rows = extract_pixel_hashes("unused.mp4", [0, 2], cv2_module=fake)
        self.assertEqual([row["frame_index"] for row in rows], [0, 2])
        self.assertTrue(fake.capture.released)

    def test_fails_when_video_ends_before_contract(self):
        fake = FakeCV2([FakeFrame()])
        with self.assertRaisesRegex(RuntimeError, "video ended"):
            extract_pixel_hashes("unused.mp4", [0, 2], cv2_module=fake)

    def test_builds_deterministic_non_accuracy_manifest(self):
        with tempfile.TemporaryDirectory() as root:
            video, cache = self.files(root)
            frames = [FakeFrame(value) for value in range(3)]
            result = build_holdout_manifest(video, cache, cv2_module=FakeCV2(frames))
            self.assertEqual(result["frame_count"], 2)
            self.assertEqual(result["status"], "HELDOUT_PIXEL_FINGERPRINTS_NOT_MODEL_ACCURACY")
            self.assertEqual(len(result["frames_fingerprint_sha256"]), 64)

    def test_builds_perceptual_manifest_with_fixed_thresholds(self):
        with tempfile.TemporaryDirectory() as root:
            video, cache = self.files(root)
            frames = [FakeFrame(value) for value in range(3)]
            def fake_perceptual(frame):
                value = frame.pixels[0]
                return {"dhash64": f"{value:016x}", "phash64": f"{value + 10:016x}"}
            result = build_perceptual_holdout_manifest(
                video, cache, cv2_module=FakeCV2(frames),
                perceptual_hasher=fake_perceptual,
            )
            self.assertEqual(result["frame_count"], 2)
            self.assertEqual(result["perceptual_match"]["dhash64_max_hamming"], 3)
            self.assertEqual(result["perceptual_match"]["phash64_max_hamming"], 2)
            self.assertTrue(result["status"].endswith("NOT_MODEL_ACCURACY"))


if __name__ == "__main__":
    unittest.main()

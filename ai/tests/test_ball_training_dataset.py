import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from sevenmetros_ai.ball_holdout import PERCEPTUAL_SCHEMA, SCHEMA as HOLDOUT_SCHEMA
from sevenmetros_ai.ball_training_dataset import (
    PERCEPTUAL_STATUS,
    STATUS,
    validate_yolo_dataset,
)


def fake_pixel_hash(path):
    return hashlib.sha256(b"decoded:" + Path(path).read_bytes()).hexdigest()


def fake_perceptual_hash(path):
    digest = hashlib.sha256(b"perceptual:" + Path(path).read_bytes()).hexdigest()
    return {"dhash64": digest[:16], "phash64": digest[16:32]}


class BallTrainingDatasetTests(unittest.TestCase):
    def dataset(self, root):
        root = Path(root)
        config = {"path": ".", "train": "images/train", "val": "images/val", "test": "images/test", "names": ["pelota"]}
        for index, split in enumerate(("train", "val", "test"), 1):
            image = root / "images" / split / f"sample-{index}.jpg"
            label = root / "labels" / split / f"sample-{index}.txt"
            image.parent.mkdir(parents=True, exist_ok=True)
            label.parent.mkdir(parents=True, exist_ok=True)
            image.write_bytes(f"image-{index}".encode())
            label.write_text("0 0.5 0.5 0.2 0.2\n" if split != "test" else "", encoding="utf-8")
        holdout = {
            "schema_version": HOLDOUT_SCHEMA,
            "frame_count": 1,
            "frames_fingerprint_sha256": "f" * 64,
            "frames": [{"frame_index": 7, "pixel_sha256": "a" * 64}],
        }
        return config, root / "data.yaml", holdout

    def perceptual_holdout(self, holdout, dhash64="ffffffffffffffff", phash64="ffffffffffffffff"):
        frames = [{
            **holdout["frames"][0],
            "dhash64": dhash64,
            "phash64": phash64,
        }]
        holdout.update({
            "schema_version": PERCEPTUAL_SCHEMA,
            "perceptual_match": {
                "logic": "dhash64_distance_lte_AND_phash64_distance_lte",
                "dhash64_max_hamming": 3,
                "phash64_max_hamming": 2,
            },
            "frames": frames,
            "frames_fingerprint_sha256": hashlib.sha256(
                json.dumps(frames, sort_keys=True, separators=(",", ":")).encode("ascii")
            ).hexdigest(),
        })
        return holdout

    def test_accepts_complete_single_class_dataset_deterministically(self):
        with tempfile.TemporaryDirectory() as root:
            config, yaml_path, holdout = self.dataset(root)
            first = validate_yolo_dataset(config, yaml_path, holdout, image_pixel_hasher=fake_pixel_hash)
            second = validate_yolo_dataset(config, yaml_path, holdout, image_pixel_hasher=fake_pixel_hash)
            self.assertEqual(first, second)
            self.assertEqual(first["status"], STATUS)
            self.assertEqual(first["totals"], {"image_count": 3, "label_count": 3, "box_count": 2, "negative_image_count": 1})
            self.assertEqual(first["holdout"]["pixel_overlap_count"], 0)

    def test_rejects_duplicate_bytes_across_splits(self):
        with tempfile.TemporaryDirectory() as root:
            config, yaml_path, holdout = self.dataset(root)
            (Path(root) / "images/val/sample-2.jpg").write_bytes(b"image-1")
            with self.assertRaisesRegex(ValueError, "duplicate image bytes"):
                validate_yolo_dataset(config, yaml_path, holdout, image_pixel_hasher=fake_pixel_hash)

    def test_rejects_duplicate_decoded_pixels_with_different_files(self):
        with tempfile.TemporaryDirectory() as root:
            config, yaml_path, holdout = self.dataset(root)
            def colliding_pixel_hash(path):
                path = Path(path)
                if path.parent.name in {"train", "val"}:
                    return "b" * 64
                return fake_pixel_hash(path)
            with self.assertRaisesRegex(ValueError, "duplicate decoded pixels"):
                validate_yolo_dataset(config, yaml_path, holdout, image_pixel_hasher=colliding_pixel_hash)

    def test_rejects_missing_and_orphan_labels(self):
        with tempfile.TemporaryDirectory() as root:
            config, yaml_path, holdout = self.dataset(root)
            (Path(root) / "labels/train/sample-1.txt").unlink()
            with self.assertRaisesRegex(ValueError, "no label file"):
                validate_yolo_dataset(config, yaml_path, holdout, image_pixel_hasher=fake_pixel_hash)
        with tempfile.TemporaryDirectory() as root:
            config, yaml_path, holdout = self.dataset(root)
            (Path(root) / "labels/train/orphan.txt").write_text("", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "label has no image"):
                validate_yolo_dataset(config, yaml_path, holdout, image_pixel_hasher=fake_pixel_hash)

    def test_rejects_wrong_class_and_out_of_bounds_box(self):
        with tempfile.TemporaryDirectory() as root:
            config, yaml_path, holdout = self.dataset(root)
            config["names"] = ["player"]
            with self.assertRaisesRegex(ValueError, "must name a ball"):
                validate_yolo_dataset(config, yaml_path, holdout, image_pixel_hasher=fake_pixel_hash)
        with tempfile.TemporaryDirectory() as root:
            config, yaml_path, holdout = self.dataset(root)
            (Path(root) / "labels/train/sample-1.txt").write_text("0 0.05 0.5 0.2 0.2\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "outside the image"):
                validate_yolo_dataset(config, yaml_path, holdout, image_pixel_hasher=fake_pixel_hash)

    def test_rejects_exact_heldout_pixel_collision(self):
        with tempfile.TemporaryDirectory() as root:
            config, yaml_path, holdout = self.dataset(root)
            collision = Path(root) / "images/val/sample-2.jpg"
            holdout["frames"][0]["pixel_sha256"] = fake_pixel_hash(collision)
            with self.assertRaisesRegex(ValueError, "held-out pixel contamination"):
                validate_yolo_dataset(config, yaml_path, holdout, image_pixel_hasher=fake_pixel_hash)

    def test_accepts_perceptual_contract_and_records_hashes(self):
        with tempfile.TemporaryDirectory() as root:
            config, yaml_path, holdout = self.dataset(root)
            self.perceptual_holdout(holdout)
            report = validate_yolo_dataset(
                config, yaml_path, holdout,
                image_pixel_hasher=fake_pixel_hash,
                image_perceptual_hasher=fake_perceptual_hash,
            )
            self.assertEqual(report["status"], PERCEPTUAL_STATUS)
            self.assertEqual(report["holdout"]["perceptual_match_count"], 0)
            self.assertIn("dhash64", report["files"][0])

    def test_rejects_near_perceptual_heldout_collision(self):
        with tempfile.TemporaryDirectory() as root:
            config, yaml_path, holdout = self.dataset(root)
            target = Path(root) / "images/val/sample-2.jpg"
            target_hash = fake_perceptual_hash(target)
            near_dhash = f"{int(target_hash['dhash64'], 16) ^ 0b111:016x}"
            near_phash = f"{int(target_hash['phash64'], 16) ^ 0b11:016x}"
            self.perceptual_holdout(holdout, near_dhash, near_phash)
            with self.assertRaisesRegex(ValueError, "perceptual contamination.*dHash=3, pHash=2"):
                validate_yolo_dataset(
                    config, yaml_path, holdout,
                    image_pixel_hasher=fake_pixel_hash,
                    image_perceptual_hasher=fake_perceptual_hash,
                )

    def test_rejects_perceptual_threshold_drift(self):
        with tempfile.TemporaryDirectory() as root:
            config, yaml_path, holdout = self.dataset(root)
            self.perceptual_holdout(holdout)
            holdout["perceptual_match"]["dhash64_max_hamming"] = 4
            with self.assertRaisesRegex(ValueError, "thresholds differ"):
                validate_yolo_dataset(
                    config, yaml_path, holdout,
                    image_pixel_hasher=fake_pixel_hash,
                    image_perceptual_hasher=fake_perceptual_hash,
                )

    def test_rejects_training_split_with_only_negatives(self):
        with tempfile.TemporaryDirectory() as root:
            config, yaml_path, holdout = self.dataset(root)
            (Path(root) / "labels/train/sample-1.txt").write_text("", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "at least one labeled ball"):
                validate_yolo_dataset(config, yaml_path, holdout, image_pixel_hasher=fake_pixel_hash)

    def test_rejects_incomplete_holdout_contract(self):
        with tempfile.TemporaryDirectory() as root:
            config, yaml_path, holdout = self.dataset(root)
            holdout["frame_count"] = 2
            with self.assertRaisesRegex(ValueError, "frame_count"):
                validate_yolo_dataset(config, yaml_path, holdout, image_pixel_hasher=fake_pixel_hash)


if __name__ == "__main__":
    unittest.main()

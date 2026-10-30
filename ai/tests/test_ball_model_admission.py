import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from sevenmetros_ai.ball_model_admission import ADMITTED, REJECTED, admit_ball_model

VIDEO_SHA = "1" * 64


class BallModelAdmissionTests(unittest.TestCase):
    def fixture(self, root, **updates):
        root = Path(root)
        model = root / "handball.pt"
        model.write_bytes(b"trusted-test-checkpoint")
        payload = {
            "schema": "sevenmetros.ball-model-provenance/v1",
            "model_sha256": hashlib.sha256(model.read_bytes()).hexdigest(),
            "source_url": "https://example.org/handball.pt",
            "license": {"id": "CC-BY-4.0", "url": "https://example.org/license"},
            "training_data": [{"url": "https://example.org/data", "license_id": "CC-BY-4.0"}],
            "evaluation_exclusions": [{"video_sha256": VIDEO_SHA, "excluded_from_training": True}],
            "model": {"task": "detect", "ball_class_id": 0,
                      "ball_class_name": "ball", "specialized_single_class": True},
        }
        payload.update(updates)
        provenance = root / "provenance.json"
        provenance.write_text(json.dumps(payload), encoding="utf-8")
        return model, provenance

    def test_admits_matching_single_class_detector(self):
        with tempfile.TemporaryDirectory() as root:
            model, provenance = self.fixture(root)
            report = admit_ball_model(model, provenance, VIDEO_SHA,
                                      model_loader=lambda _: SimpleNamespace(task="detect", names={0: "ball"}))
            self.assertEqual(report["status"], ADMITTED)
            self.assertEqual(report["errors"], [])
            self.assertEqual(report["accuracy_status"], "NOT_EVALUATED")

    def test_rejects_hash_mismatch_before_loading(self):
        with tempfile.TemporaryDirectory() as root:
            model, provenance = self.fixture(root, model_sha256="0" * 64)
            calls = []
            report = admit_ball_model(model, provenance, VIDEO_SHA,
                                      model_loader=lambda path: calls.append(path))
            self.assertEqual(report["status"], REJECTED)
            self.assertIn("model SHA256 differs from provenance", report["errors"])
            self.assertEqual(calls, [])

    def test_rejects_missing_evaluation_exclusion_before_loading(self):
        with tempfile.TemporaryDirectory() as root:
            model, provenance = self.fixture(root, evaluation_exclusions=[])
            calls = []
            report = admit_ball_model(model, provenance, VIDEO_SHA,
                                      model_loader=lambda path: calls.append(path))
            self.assertIn("evaluation video is not explicitly excluded from training", report["errors"])
            self.assertEqual(calls, [])

    def test_rejects_multiclass_checkpoint(self):
        with tempfile.TemporaryDirectory() as root:
            model, provenance = self.fixture(root)
            report = admit_ball_model(model, provenance, VIDEO_SHA,
                                      model_loader=lambda _: SimpleNamespace(task="detect", names={0: "ball", 1: "player"}))
            self.assertIn("checkpoint is not single-class specialized", report["errors"])

    def test_rejects_class_name_drift(self):
        with tempfile.TemporaryDirectory() as root:
            model, provenance = self.fixture(root)
            report = admit_ball_model(model, provenance, VIDEO_SHA,
                                      model_loader=lambda _: SimpleNamespace(task="detect", names={0: "sports ball"}))
            self.assertIn("declared ball class name differs from checkpoint", report["errors"])


if __name__ == "__main__":
    unittest.main()

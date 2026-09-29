import hashlib
from pathlib import Path
import tempfile
import unittest

from run_fixture import _verify_model_sha256


class DetectorWeightIntegrityTests(unittest.TestCase):
    def test_accepts_exact_local_weight_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'yolo11n.pt'
            path.write_bytes(b'weights')
            expected = hashlib.sha256(b'weights').hexdigest()
            self.assertEqual(_verify_model_sha256(path, expected), expected)

    def test_rejects_wrong_weight_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'yolo11n.pt'
            path.write_bytes(b'weights')
            with self.assertRaisesRegex(ValueError, 'Model SHA256 mismatch'):
                _verify_model_sha256(path, '0' * 64)

    def test_strict_mode_requires_local_weight_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing = Path(tmp) / 'missing.pt'
            with self.assertRaisesRegex(FileNotFoundError, 'local weight file'):
                _verify_model_sha256(missing, '0' * 64)

    def test_rejects_malformed_expected_hash(self):
        with self.assertRaisesRegex(ValueError, '64 hexadecimal'):
            _verify_model_sha256('whatever.pt', 'not-a-sha')

    def test_non_strict_mode_preserves_legacy_resolution(self):
        self.assertIsNone(_verify_model_sha256('yolo11n.pt', None))


if __name__ == '__main__':
    unittest.main()

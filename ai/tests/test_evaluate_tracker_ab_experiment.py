import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from evaluate_tracker_ab_experiment import _slice_for, parse_task_spec


class TrackerABEvaluationHelpersTests(unittest.TestCase):
    def test_parse_task_spec(self):
        label, path = parse_task_spec('gt1=/tmp/task')
        self.assertEqual(label, 'gt1')
        self.assertEqual(path, Path('/tmp/task'))

    def test_selects_covering_slice_and_verifies_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            slice_dir = root / 'control' / 'retained_gt_ranges'
            slice_dir.mkdir(parents=True)
            path = slice_dir / 'two_stage__frames_10_20.jsonl'
            path.write_text('{}\n', encoding='utf-8')
            sha = hashlib.sha256(path.read_bytes()).hexdigest()
            run = {
                'label': 'control',
                'retained_slices': {
                    'two_stage': [{
                        'start_frame': 10,
                        'end_frame_exclusive': 20,
                        'sha256': sha,
                    }],
                },
            }
            selected = _slice_for(root, run, 'two_stage', [12, 13, 14])
            self.assertEqual(selected, path)

    def test_rejects_modified_slice(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            slice_dir = root / 'control' / 'retained_gt_ranges'
            slice_dir.mkdir(parents=True)
            path = slice_dir / 'two_stage__frames_10_20.jsonl'
            path.write_text('changed\n', encoding='utf-8')
            run = {
                'label': 'control',
                'retained_slices': {
                    'two_stage': [{
                        'start_frame': 10,
                        'end_frame_exclusive': 20,
                        'sha256': '0' * 64,
                    }],
                },
            }
            with self.assertRaisesRegex(ValueError, 'hash mismatch'):
                _slice_for(root, run, 'two_stage', [12])


if __name__ == '__main__':
    unittest.main()

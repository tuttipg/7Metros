import csv
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from import_reviewed_gt import import_review


def write_json(path, value):
    path.write_text(json.dumps(value) + '\n', encoding='utf-8')


class ImportReviewedGtTests(unittest.TestCase):
    def make_inputs(self, root):
        task = Path(root) / 'task'
        task.mkdir()
        frames = task / 'frames.csv'
        frames.write_text(
            'task_frame,source_frame,source_timestamp_ms,image\n'
            '1,10,333.333,000001.jpg\n2,11,366.667,000002.jpg\n'
        )
        digest = hashlib.sha256(frames.read_bytes()).hexdigest()
        write_json(task / 'manifest.json', {
            'task_frames': 2, 'fps': 30.0, 'width': 100, 'height': 80,
            'proposal_boxes': 2, 'source_start_frame': 10,
            'source_end_frame_exclusive': 12, 'frames_csv_sha256': digest,
        })
        payload = {
            'version': 2, 'status': 'HUMAN_REVIEW_COMPLETE',
            'manifest': {'manifest_sha256': 'abc', 'frames': 2, 'fps': 30,
                         'width': 100, 'height': 80, 'seed_boxes': 2,
                         'source_fixture_frames': [10, 11]},
            'reviewed': [True, True], 'reviewed_frames': 2,
            'reviewed_by': 'reviewer',
            'reviewed_at': '2026-09-28T02:57:06Z',
            'boxes': [[{'id': 7, 'x': 1, 'y': 2, 'w': 3, 'h': 4}],
                      [{'id': 7, 'x': 2, 'y': 2, 'w': 3, 'h': 4}]],
        }
        source = Path(root) / 'review.json'
        write_json(source, payload)
        return task, source, payload

    def test_imports_complete_review_with_provenance(self):
        with tempfile.TemporaryDirectory() as tmp:
            task, source, _ = self.make_inputs(tmp)
            result = import_review(source, task, 'abc')
            self.assertEqual(result['gt_rows'], 2)
            with (task / 'gt' / 'gt.txt').open(newline='') as stream:
                rows = list(csv.reader(stream))
            self.assertEqual(rows[0][:2], ['1', '7'])
            self.assertEqual(result['source_task_manifest_sha256'], 'abc')

    def test_rejects_incomplete_review(self):
        with tempfile.TemporaryDirectory() as tmp:
            task, source, payload = self.make_inputs(tmp)
            payload['reviewed'][1] = False
            write_json(source, payload)
            with self.assertRaisesRegex(ValueError, 'Every task frame'):
                import_review(source, task, 'abc')

    def test_rejects_duplicate_identity(self):
        with tempfile.TemporaryDirectory() as tmp:
            task, source, payload = self.make_inputs(tmp)
            payload['boxes'][0].append(dict(payload['boxes'][0][0]))
            write_json(source, payload)
            with self.assertRaisesRegex(ValueError, 'Duplicate identity'):
                import_review(source, task, 'abc')

    def test_rejects_wrong_task_digest(self):
        with tempfile.TemporaryDirectory() as tmp:
            task, source, _ = self.make_inputs(tmp)
            with self.assertRaisesRegex(ValueError, 'expected task manifest'):
                import_review(source, task, 'def')

    def test_applies_explicit_auditable_identity_correction(self):
        with tempfile.TemporaryDirectory() as tmp:
            task, source, _ = self.make_inputs(tmp)
            result = import_review(source, task, 'abc', [(1, 7, 9)])
            with (task / 'gt' / 'gt.txt').open(newline='') as stream:
                rows = list(csv.reader(stream))
            self.assertEqual(rows[0][1], '9')
            self.assertEqual(rows[1][1], '7')
            self.assertEqual(result['id_corrections'][0]['task_frame'], 1)


if __name__ == '__main__':
    unittest.main()

import json
from pathlib import Path
import tempfile
import unittest

from audit_mot_errors import build, match_frame, read_mot

try:
    import scipy  # noqa: F401
except ImportError:
    scipy = None


class MotErrorInputTests(unittest.TestCase):
    def test_rejects_duplicate_identity_in_frame(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'rows.txt'
            path.write_text(
                '1,7,0,0,10,10,1,1,1\n1,7,20,0,10,10,1,1,1\n'
            )
            with self.assertRaisesRegex(ValueError, 'repeats ID 7'):
                read_mot(path, frames=1)

    def test_rejects_nonpositive_box(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'rows.txt'
            path.write_text('1,7,0,0,0,10,1,1,1\n')
            with self.assertRaisesRegex(ValueError, 'degenerate'):
                read_mot(path, frames=1)


@unittest.skipIf(scipy is None, 'optional scipy required')
class MotErrorAuditTests(unittest.TestCase):
    def row(self, identity, box):
        return {'id': identity, 'box': box}

    def test_matching_maximizes_cardinality_before_iou(self):
        gt = [self.row(1, (0, 0, 10, 10)), self.row(2, (4, 0, 14, 10))]
        tracker = [
            self.row(8, (1, 0, 11, 10)),
            self.row(9, (-3, 0, 7, 10)),
        ]
        matches = match_frame(gt, tracker, .3)
        self.assertEqual(len(matches), 2)

    def test_build_verifies_trackeval_counts_and_attributes_ids(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            gt = root / 'gt.txt'
            gt.write_text(
                '1,1,0,0,10,10,1,1,1\n'
                '2,1,1,0,10,10,1,1,1\n'
            )
            tracker = root / 'tracker.txt'
            tracker.write_text(
                '1,4,0,0,10,10,.9,-1,-1,-1\n'
                '1,9,20,0,10,10,.8,-1,-1,-1\n'
            )
            expected = root / 'expected.json'
            expected.write_text(json.dumps({
                'metrics_percent_except_counts': {
                    'candidate': {'TP': 1, 'FN': 1, 'FP': 1},
                },
            }))
            output = root / 'audit.json'
            result = build(
                gt, [('candidate', tracker)], output,
                frames=2, baseline='candidate', expected_trackeval=expected,
            )
            self.assertEqual(result['trackeval_count_verification'], 'MATCH')
            audit = result['trackers']['candidate']
            self.assertEqual(audit['missed_gt_ids'], {1: 1})
            self.assertEqual(audit['false_positive_track_ids'], {9: 1})
            self.assertEqual(
                audit['gt_identity_diagnostics']['1']['matched_tracker_ids'],
                [{'tracker_id': 4, 'frames': 1}],
            )


if __name__ == '__main__':
    unittest.main()

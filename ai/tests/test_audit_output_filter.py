from pathlib import Path
import tempfile
import unittest

from audit_output_filter import _frame_ranges, build

try:
    import scipy  # noqa: F401
except ImportError:
    scipy = None


class OutputFilterInputTests(unittest.TestCase):
    def write(self, path, rows):
        path.write_text(''.join(rows), encoding='utf-8')

    def test_frame_ranges_are_compact_and_deterministic(self):
        self.assertEqual(_frame_ranges([1, 2, 4, 7, 8, 9]), [[1, 2], [4, 4], [7, 9]])

    def test_added_or_changed_observation_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            gt, before, after = root/'gt.txt', root/'before.txt', root/'after.txt'
            self.write(gt, ['1,1,0,0,10,10,1,1,1\n'])
            self.write(before, ['1,7,0,0,10,10,.9,-1,-1,-1\n'])
            self.write(after, ['1,7,1,0,10,10,.9,-1,-1,-1\n'])
            with self.assertRaisesRegex(ValueError, 'not an output-only filter'):
                build(
                    gt, [('candidate', before)], [('candidate', after)],
                    root/'audit.json', frames=1,
                )

    def test_tracker_labels_must_match(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            gt, rows = root/'gt.txt', root/'rows.txt'
            self.write(gt, ['1,1,0,0,10,10,1,1,1\n'])
            self.write(rows, ['1,7,0,0,10,10,.9,-1,-1,-1\n'])
            with self.assertRaisesRegex(ValueError, 'labels must match'):
                build(
                    gt, [('before', rows)], [('after', rows)],
                    root/'audit.json', frames=1,
                )


@unittest.skipIf(scipy is None, 'optional scipy required')
class OutputFilterAuditTests(unittest.TestCase):
    def write(self, path, rows):
        path.write_text(''.join(rows), encoding='utf-8')

    def test_false_positive_only_removal_is_verified(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            gt, before, after = root/'gt.txt', root/'before.txt', root/'after.txt'
            self.write(gt, ['1,1,0,0,10,10,1,1,1\n'])
            self.write(before, [
                '1,7,0,0,10,10,.9,-1,-1,-1\n',
                '1,8,20,0,10,10,.9,-1,-1,-1\n',
            ])
            self.write(after, ['1,7,0,0,10,10,.9,-1,-1,-1\n'])
            result = build(
                gt, [('candidate', before)], [('candidate', after)],
                root/'audit.json', frames=1,
            )
            self.assertEqual(result['status'], 'OUTPUT_FILTER_VERIFIED_ON_REVIEWED_GT')
            audit = result['trackers']['candidate']
            self.assertEqual(audit['removed_observations'], 1)
            self.assertEqual(audit['before'], {'TP': 1, 'FN': 0, 'FP': 1})
            self.assertEqual(audit['after'], {'TP': 1, 'FN': 0, 'FP': 0})
            self.assertEqual(audit['removed_matched_before'], 0)

    def test_ground_truth_removal_is_reported(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            gt, before, after = root/'gt.txt', root/'before.txt', root/'after.txt'
            self.write(gt, ['1,1,0,0,10,10,1,1,1\n'])
            self.write(before, ['1,7,0,0,10,10,.9,-1,-1,-1\n'])
            self.write(after, [])
            result = build(
                gt, [('candidate', before)], [('candidate', after)],
                root/'audit.json', frames=1,
            )
            self.assertEqual(result['status'], 'OUTPUT_FILTER_GT_LOSS_DETECTED')
            audit = result['trackers']['candidate']
            self.assertEqual(audit['removed_matched_before'], 1)
            self.assertEqual(audit['removed_gt_ids'], {1: 1})

    def test_require_safe_turns_gt_removal_into_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            gt, before, after = root/'gt.txt', root/'before.txt', root/'after.txt'
            self.write(gt, ['1,1,0,0,10,10,1,1,1\n'])
            self.write(before, ['1,7,0,0,10,10,.9,-1,-1,-1\n'])
            self.write(after, [])
            with self.assertRaisesRegex(RuntimeError, 'removed or overlapped'):
                build(
                    gt, [('candidate', before)], [('candidate', after)],
                    root/'audit.json', frames=1, require_safe=True,
                )

if __name__ == '__main__':
    unittest.main()

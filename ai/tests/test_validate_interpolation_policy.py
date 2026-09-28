import json
from pathlib import Path
import tempfile
import unittest

from validate_interpolation_policy import validate


class InterpolationPolicyTests(unittest.TestCase):
    def result(self, root, name, sequence, **metrics):
        path = Path(root) / f'{name}.json'
        payload = {
            'status': 'OFFICIAL_TRACKEVAL_ON_HUMAN_REVIEWED_GT',
            'scope': {'sequence': sequence},
            'metrics_percent_except_counts': {'two_stage': {
                'HOTA': 80, 'IDF1': 85, 'MOTA': 75, 'TP': 100,
                'FN': 20, 'FP': 10, 'IDSW': 5, 'fragments': 8,
                **metrics,
            }},
        }
        path.write_text(json.dumps(payload), encoding='utf-8')
        return path

    def test_accepts_consistent_non_regression(self):
        with tempfile.TemporaryDirectory() as tmp:
            c1 = self.result(tmp, 'c1', 'one')
            a1 = self.result(tmp, 'a1', 'one', HOTA=81, IDF1=86,
                             IDSW=5, fragments=7)
            c2 = self.result(tmp, 'c2', 'two')
            a2 = self.result(tmp, 'a2', 'two', HOTA=80.1, IDF1=85.2,
                             IDSW=4, fragments=8)
            result = validate([('gt1', c1), ('gt2', c2)],
                              [('gt1', a1), ('gt2', a2)], 'two_stage')
            self.assertEqual(
                result['status'],
                'INTERPOLATION_POLICY_VERIFIED_ACROSS_REVIEWED_GT',
            )

    def test_rejects_one_sequence_hota_regression(self):
        with tempfile.TemporaryDirectory() as tmp:
            control = self.result(tmp, 'control', 'one')
            candidate = self.result(tmp, 'candidate', 'one', HOTA=79.9)
            result = validate([('gt1', control)], [('gt1', candidate)], 'two_stage')
            self.assertEqual(result['status'], 'INTERPOLATION_POLICY_REJECTED')
            self.assertFalse(result['sequences']['gt1']['safe'])

    def test_rejects_sequence_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            control = self.result(tmp, 'control', 'one')
            candidate = self.result(tmp, 'candidate', 'two')
            with self.assertRaisesRegex(ValueError, 'Sequence mismatch'):
                validate([('gt1', control)], [('gt1', candidate)], 'two_stage')


if __name__ == '__main__':
    unittest.main()

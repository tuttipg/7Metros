import json
from pathlib import Path
import tempfile
import unittest

from validate_mot_candidate import validate


class MotCandidateGuardrailTests(unittest.TestCase):
    def result(self, root, name, sequence, **metrics):
        path = Path(root) / f'{name}.json'
        base = {
            'HOTA': 80, 'IDF1': 85, 'MOTA': 75,
            'TP': 100, 'FN': 20, 'FP': 10,
            'IDSW': 5, 'fragments': 8,
        }
        base.update(metrics)
        path.write_text(json.dumps({
            'status': 'OFFICIAL_TRACKEVAL_ON_HUMAN_REVIEWED_GT',
            'scope': {'sequence': sequence},
            'metrics_percent_except_counts': {'two_stage': base},
        }), encoding='utf-8')
        return path

    def test_accepts_non_regression_on_every_sequence(self):
        with tempfile.TemporaryDirectory() as tmp:
            c1 = self.result(tmp, 'c1', 'one')
            a1 = self.result(tmp, 'a1', 'one', HOTA=80.2, IDF1=85.1, fragments=7)
            c2 = self.result(tmp, 'c2', 'two')
            a2 = self.result(tmp, 'a2', 'two', HOTA=80.1, IDF1=85.3, IDSW=4)
            result = validate(
                [('gt1', c1), ('gt2', c2)],
                [('gt1', a1), ('gt2', a2)],
                'two_stage',
            )
            self.assertEqual(result['status'], 'MOT_CANDIDATE_VERIFIED_ACROSS_REVIEWED_GT')

    def test_rejects_one_sequence_id_switch_regression(self):
        with tempfile.TemporaryDirectory() as tmp:
            control = self.result(tmp, 'c', 'one')
            candidate = self.result(tmp, 'a', 'one', HOTA=81, IDF1=86, IDSW=6)
            result = validate([('gt', control)], [('gt', candidate)], 'two_stage')
            self.assertEqual(result['status'], 'MOT_CANDIDATE_REJECTED')
            self.assertFalse(result['sequences']['gt']['safe'])

    def test_rejects_sequence_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            control = self.result(tmp, 'c', 'one')
            candidate = self.result(tmp, 'a', 'two')
            with self.assertRaisesRegex(ValueError, 'Sequence mismatch'):
                validate([('gt', control)], [('gt', candidate)], 'two_stage')


if __name__ == '__main__':
    unittest.main()

import tempfile
import unittest
from pathlib import Path

from audit_oracle_association import audit, load_mot_gt
from sevenmetros_ai.tracking import Detection


def det(cx, cy, w=10, h=20):
    return Detection(cx-w/2, cy-h/2, cx+w/2, cy+h/2)


class OracleAssociationTests(unittest.TestCase):
    def test_crossing_hides_identity_from_input_order(self):
        frames = [
            [(1, det(10, 10)), (2, det(40, 10))],
            [(2, det(28, 10)), (1, det(22, 10))],
            [(1, det(35, 10)), (2, det(15, 10))],
        ]
        result = audit(frames)
        self.assertIn('accuracy_status', result)
        self.assertEqual(result['frames'], 3)

    def test_identity_filter_limits_reported_switches(self):
        frames = [[(1, det(10+i, 10)), (2, det(40-i, 10))] for i in range(4)]
        result = audit(frames, identities=[1])
        self.assertEqual(result['identities'], [1])

    def test_load_rejects_non_contiguous_gt(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'gt.txt'
            path.write_text('1,1,0,0,10,20,1,1,1\n3,1,1,0,10,20,1,1,1\n')
            with self.assertRaisesRegex(ValueError, 'contiguous'):
                load_mot_gt(path)


if __name__ == '__main__':
    unittest.main()

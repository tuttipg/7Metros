import unittest

from audit_review_continuity import audit


def box(identity, cx, cy=10, size=4):
    return {
        'id': identity,
        'x': cx - size / 2,
        'y': cy - size / 2,
        'w': size,
        'h': size,
    }


class ReviewContinuityAuditTests(unittest.TestCase):
    def test_flags_isolated_reciprocal_swap(self):
        payload = {
            'boxes': [
                [box(1, 10), box(2, 30)],
                [box(1, 29), box(2, 11)],
                [box(1, 12), box(2, 32)],
            ]
        }
        result = audit(payload, minimum_improvement=20)
        self.assertEqual(result['warning_count'], 1)
        warning = result['warnings'][0]
        self.assertEqual(warning['task_frame'], 2)
        self.assertEqual(warning['ids'], [1, 2])
        self.assertGreater(warning['improvement_px'], 20)

    def test_does_not_flag_normal_crossing_motion(self):
        payload = {
            'boxes': [
                [box(1, 10), box(2, 30)],
                [box(1, 16), box(2, 24)],
                [box(1, 22), box(2, 18)],
            ]
        }
        result = audit(payload, minimum_improvement=5)
        self.assertEqual(result['warning_count'], 0)

    def test_warning_never_mutates_payload(self):
        payload = {
            'boxes': [
                [box(1, 10), box(2, 30)],
                [box(1, 29), box(2, 11)],
                [box(1, 12), box(2, 32)],
            ]
        }
        before = repr(payload)
        audit(payload, minimum_improvement=20)
        self.assertEqual(repr(payload), before)

    def test_rejects_duplicate_identity_in_frame(self):
        payload = {
            'boxes': [
                [box(1, 10)],
                [box(1, 12), box(1, 20)],
                [box(1, 14)],
            ]
        }
        with self.assertRaises(ValueError):
            audit(payload)


if __name__ == '__main__':
    unittest.main()

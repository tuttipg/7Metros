from pathlib import Path
import tempfile
import unittest

from prepare_mot_annotation import ensure_new_output, mot_seed_row, validate_object


class MotAnnotationTests(unittest.TestCase):
    def test_seed_row_uses_relative_one_based_frame(self):
        observation = {
            'track_id': 7,
            'bbox_xyxy': [10, 20, 30, 55],
            'confidence': .81234567,
            'kind': 'player',
        }
        self.assertEqual(
            mot_seed_row(1, observation, 100, 80),
            [1, 7, 10.0, 20.0, 20.0, 35.0, .812346, 1, -1],
        )

    def test_invalid_boxes_and_ids_are_rejected(self):
        base = {
            'track_id': 1,
            'bbox_xyxy': [1, 2, 10, 20],
            'confidence': .8,
            'kind': 'player',
        }
        for change in [
            {'track_id': 0},
            {'track_id': 1.5},
            {'confidence': float('nan')},
            {'confidence': 1.01},
            {'kind': 'ball'},
            {'bbox_xyxy': [-1, 2, 10, 20]},
            {'bbox_xyxy': [10, 2, 10, 20]},
            {'bbox_xyxy': [1, 2, 101, 20]},
        ]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_object({**base, **change}, 100, 80)

    def test_nonempty_output_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'task'
            self.assertEqual(ensure_new_output(output), output)
            (output / 'keep.txt').write_text('do not overwrite')
            with self.assertRaisesRegex(ValueError, 'not empty'):
                ensure_new_output(output)


if __name__ == '__main__':
    unittest.main()

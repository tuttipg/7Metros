import json
import tempfile
import unittest
from pathlib import Path

from audit_detection_ambiguity import audit, load_gt


class DetectionAmbiguityTests(unittest.TestCase):
    def test_detects_one_box_overlapping_two_gt_ids(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            gt = root / 'gt.txt'
            gt.write_text('1,1,0,0,10,10,1,1,1\n1,2,5,0,10,10,1,1,1\n')
            cache = root / 'detections.jsonl'
            cache.write_text(json.dumps([{
                'x1': 2, 'y1': 0, 'x2': 13, 'y2': 10,
                'confidence': .8, 'label': 'player',
            }]) + '\n')
            result = audit(cache, load_gt(gt), source_start=0,
                           identities=[1, 2], overlap=.2)
            self.assertEqual(result['ambiguous_frame_count'], 1)
            self.assertEqual(result['frames_with_all_identities_visible'], 1)

    def test_ignores_low_confidence_box(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            gt = root / 'gt.txt'
            gt.write_text('1,1,0,0,10,10,1,1,1\n1,2,5,0,10,10,1,1,1\n')
            cache = root / 'detections.jsonl'
            cache.write_text(json.dumps([{
                'x1': 2, 'y1': 0, 'x2': 13, 'y2': 10,
                'confidence': .1, 'label': 'player',
            }]) + '\n')
            result = audit(cache, load_gt(gt), source_start=0,
                           identities=[1, 2], overlap=.2, min_conf=.25)
            self.assertEqual(result['ambiguous_frame_count'], 0)


if __name__ == '__main__':
    unittest.main()

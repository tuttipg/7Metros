import json
import tempfile
import unittest
from pathlib import Path

from audit_detection_recall import audit


class DetectionRecallAuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        review = {
            'manifest': {'source_fixture_frames': [2, 3]},
            'boxes': [
                [{'id': 7, 'x': 0, 'y': 0, 'w': 10, 'h': 10}],
                [
                    {'id': 7, 'x': 10, 'y': 0, 'w': 10, 'h': 10},
                    {'id': 9, 'x': 30, 'y': 0, 'w': 10, 'h': 10},
                ],
            ],
        }
        self.review = self.root / 'review.json'
        self.review.write_text(json.dumps(review), encoding='utf-8')
        cache = [
            [],
            [],
            [{'x1': 0, 'y1': 0, 'x2': 10, 'y2': 10, 'confidence': .3}],
            [
                {'x1': 10, 'y1': 0, 'x2': 20, 'y2': 10, 'confidence': .2},
                {'x1': 30, 'y1': 0, 'x2': 40, 'y2': 10, 'confidence': .4},
            ],
        ]
        self.cache = self.root / 'detections.jsonl'
        self.cache.write_text(
            '\n'.join(json.dumps(frame) for frame in cache) + '\n',
            encoding='utf-8',
        )
        self.meta = self.root / 'detections.meta.json'
        self.meta.write_text(json.dumps({'confidence': .1}), encoding='utf-8')

    def tearDown(self):
        self.tmp.cleanup()

    def test_compares_multiple_confidence_thresholds(self):
        result = audit(
            self.review, self.cache, ids=[7, 9], thresholds=[.1, .25],
            cache_meta=self.meta,
        )
        self.assertEqual(
            result['ids']['7']['by_confidence']['0.1']['matched_frames'], 2
        )
        self.assertEqual(
            result['ids']['7']['by_confidence']['0.25']['matched_frames'], 1
        )
        self.assertEqual(
            result['ids']['9']['by_confidence']['0.25']['matched_frames'], 1
        )

    def test_rejects_threshold_below_cache_floor(self):
        self.meta.write_text(json.dumps({'confidence': .25}), encoding='utf-8')
        with self.assertRaises(ValueError):
            audit(
                self.review, self.cache, ids=[7], thresholds=[.1],
                cache_meta=self.meta,
            )

    def test_applies_explicit_qc_correction_once(self):
        payload = json.loads(self.review.read_text(encoding='utf-8'))
        payload['boxes'][0][0]['id'] = 70
        self.review.write_text(json.dumps(payload), encoding='utf-8')
        result = audit(
            self.review, self.cache, ids=[7], thresholds=[.25],
            cache_meta=self.meta, qc_corrections=[(1, 70, 7)],
        )
        self.assertEqual(result['ids']['7']['present_frames'], 2)
        self.assertEqual(result['qc_corrections_applied'], [[1, 70, 7]])

    def test_stratifies_recall_by_top_boundary(self):
        payload = json.loads(self.review.read_text(encoding='utf-8'))
        payload['boxes'][1][0]['y'] = 10
        self.review.write_text(json.dumps(payload), encoding='utf-8')
        result = audit(
            self.review, self.cache, ids=[7], thresholds=[.1, .25],
            cache_meta=self.meta, top_y_boundary=5,
        )
        spatial = result['ids']['7']['spatial_by_top_y']
        self.assertEqual(spatial['top_eq_0']['present_frames'], 1)
        self.assertEqual(spatial['top_lt_boundary']['present_frames'], 1)
        self.assertEqual(spatial['top_gte_boundary']['present_frames'], 1)
        self.assertEqual(
            spatial['top_lt_boundary']['by_confidence']['0.25']['matched_frames'], 1
        )
        self.assertEqual(
            spatial['top_gte_boundary']['by_confidence']['0.25']['matched_frames'], 0
        )


if __name__ == '__main__':
    unittest.main()

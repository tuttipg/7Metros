import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import benchmark_trackers
from sevenmetros_ai.tracking import Detection

try:
    import numpy as np
except ImportError:
    np = None


@unittest.skipIf(np is None, 'optional benchmark dependencies not installed')
class DetectionResultsTests(unittest.TestCase):
    def test_boolean_selection_preserves_rows(self):
        results = benchmark_trackers.DetectionResults([
            Detection(0, 0, 10, 20, .9),
            Detection(20, 10, 40, 50, .15),
        ])
        selected = results[np.asarray([False, True])]
        self.assertEqual(len(selected), 1)
        self.assertEqual(selected.xywh.tolist(), [[30.0, 30.0, 20.0, 40.0]])
        self.assertAlmostEqual(float(selected.conf[0]), .15)

    def test_empty_selection_has_two_dimensional_boxes(self):
        selected = benchmark_trackers.DetectionResults([])[np.asarray([], dtype=bool)]
        self.assertEqual(selected.xywh.shape, (0, 4))


class MetadataTests(unittest.TestCase):
    def test_rejects_high_confidence_cache(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            video = root / 'clip.mp4'
            video.write_bytes(b'clip')
            cache = root / 'detections.jsonl'
            cache.write_text('[]\n')
            cache.with_suffix('.meta.json').write_text(json.dumps({
                'video_sha256': __import__('hashlib').sha256(b'clip').hexdigest(),
                'confidence': .25,
            }))
            with self.assertRaisesRegex(ValueError, '0.10'):
                benchmark_trackers._validated_meta(video, cache)


if __name__ == '__main__':
    unittest.main()

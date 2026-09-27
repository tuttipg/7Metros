import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from run_selective_inference import write_cache
from sevenmetros_ai.tracking import Detection


class SelectiveInferenceTests(unittest.TestCase):
    def test_cache_is_sorted_and_records_source_frame_indexes(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'cache.jsonl'
            write_cache(path, {
                8: [Detection(1, 2, 3, 4, confidence=.2)],
                3: [],
            })
            rows = [json.loads(line) for line in path.read_text().splitlines()]
        self.assertEqual([row['frame_index'] for row in rows], [3, 8])
        self.assertEqual(rows[0]['objects'], [])
        self.assertEqual(rows[1]['objects'][0]['confidence'], .2)


if __name__ == '__main__':
    unittest.main()

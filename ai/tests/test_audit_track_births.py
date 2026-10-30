import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from audit_track_births import audit


def obj(track_id, x):
    return {
        'track_id': track_id,
        'kind': 'player',
        'confidence': .5,
        'bbox_xyxy': [x, 0, x + 1, 1],
    }


def write_rows(path, frames):
    path.write_text(''.join(
        json.dumps({'frame_index': frame, 'objects': objects}) + '\n'
        for frame, objects in frames
    ), encoding='utf-8')


class TrackBirthAuditTests(unittest.TestCase):
    def test_distinguishes_absorbed_shared_observation_from_missing_one(self):
        with TemporaryDirectory() as directory:
            baseline = Path(directory) / 'baseline.jsonl'
            candidate = Path(directory) / 'candidate.jsonl'
            write_rows(baseline, [
                (10, [obj(1, 0)]),
                (11, [obj(1, 1), obj(2, 5)]),
                (12, [obj(1, 2), obj(2, 6), obj(3, 9)]),
            ])
            write_rows(candidate, [
                (10, [obj(7, 0)]),
                (11, [obj(7, 5)]),
                (12, [obj(7, 2), obj(8, 6)]),
            ])
            result = audit(baseline, candidate, [(10, 13)])

        baseline_births = result['baseline_births_after_range_start']
        self.assertEqual(baseline_births['outcomes'], {
            'absorbed_by_existing_track': 1,
            'observation_replaced_or_missing': 1,
        })
        self.assertEqual(baseline_births['events'][0]['other_track_id'], 7)

    def test_rejects_incomplete_frame_ranges(self):
        with TemporaryDirectory() as directory:
            baseline = Path(directory) / 'baseline.jsonl'
            candidate = Path(directory) / 'candidate.jsonl'
            write_rows(baseline, [(1, [])])
            write_rows(candidate, [(1, []), (2, [])])
            with self.assertRaisesRegex(ValueError, 'baseline frame mismatch'):
                audit(baseline, candidate, [(1, 3)])


if __name__ == '__main__':
    unittest.main()

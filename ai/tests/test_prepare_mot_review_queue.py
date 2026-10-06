import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from prepare_mot_annotation import sha256_file
from prepare_mot_review_queue import build, greedy_matches


def row(frame, objects):
    return {
        'frame_index': frame,
        'image': {'width': 100, 'height': 100},
        'objects': objects,
    }


def obj(identity, box):
    return {
        'track_id': identity, 'bbox_xyxy': box,
        'confidence': .8, 'kind': 'player',
    }


def write_jsonl(path, rows):
    path.write_text(''.join(json.dumps(item) + '\n' for item in rows))


class MotReviewQueueTests(unittest.TestCase):
    def test_greedy_matching_is_one_to_one(self):
        first = [(0, 0, 10, 10), (20, 0, 30, 10)]
        second = [(0, 0, 10, 10), (1, 0, 11, 10)]
        self.assertEqual(len(greedy_matches(first, second, .5)), 1)

    def test_disagreement_and_transition_frames_rank_first(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            task = root / 'task'
            task.mkdir()
            (task / 'frames.csv').write_text(
                'task_frame,source_frame,source_timestamp_ms,image\n'
                '1,10,333.333,000001.jpg\n'
                '2,11,366.667,000002.jpg\n'
            )
            manifest = {
                'status': 'UNVERIFIED_TRACKER_PROPOSAL_NOT_GROUND_TRUTH',
                'task_frames': 2, 'width': 100, 'height': 100,
                'frames_csv_sha256': sha256_file(task / 'frames.csv'),
            }
            (task / 'manifest.json').write_text(json.dumps(manifest))
            first, second = root / 'first.jsonl', root / 'second.jsonl'
            write_jsonl(first, [
                row(10, [obj(1, [0, 0, 10, 10])]),
                row(11, [obj(1, [0, 0, 10, 10])]),
            ])
            write_jsonl(second, [
                row(10, [obj(7, [0, 0, 10, 10])]),
                row(11, [obj(8, [0, 0, 10, 10]), obj(9, [20, 0, 30, 10])]),
            ])
            result = build(
                task, [('first', first), ('second', second)], root / 'queue.json',
            )

        self.assertEqual(result['queue'][0]['source_frame'], 11)
        self.assertEqual(result['queue'][0]['geometric_disagreement'], 1)
        self.assertEqual(result['queue'][0]['transition_event_spread'], 3)
        self.assertFalse(result['metrics_allowed'])
        self.assertTrue(result['all_frames_still_require_human_review'])

    def test_missing_tracker_frame_is_rejected(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            task = root / 'task'
            task.mkdir()
            (task / 'frames.csv').write_text(
                'task_frame,source_frame,source_timestamp_ms,image\n1,10,0,x.jpg\n'
            )
            (task / 'manifest.json').write_text(json.dumps({
                'status': 'UNVERIFIED_TRACKER_PROPOSAL_NOT_GROUND_TRUTH',
                'task_frames': 1, 'width': 100, 'height': 100,
                'frames_csv_sha256': sha256_file(task / 'frames.csv'),
            }))
            first, second = root / 'first.jsonl', root / 'second.jsonl'
            write_jsonl(first, [row(10, [])])
            second.write_text('')
            with self.assertRaisesRegex(ValueError, 'misses source frame 10'):
                build(task, [('first', first), ('second', second)], root / 'queue.json')


if __name__ == '__main__':
    unittest.main()

import csv
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from prepare_trackeval_bundle import build, read_ground_truth, validate_review


def write_json(path, value):
    path.write_text(json.dumps(value) + '\n', encoding='utf-8')


class TrackEvalBundleTests(unittest.TestCase):
    def make_task(self, root):
        task = Path(root) / 'task'
        (task / 'seed').mkdir(parents=True)
        (task / 'gt').mkdir()
        manifest = {
            'status': 'UNVERIFIED_TRACKER_PROPOSAL_NOT_GROUND_TRUTH',
            'task_frames': 2, 'width': 100, 'height': 80, 'fps': 30,
            'sequence': 'hard_reentry',
        }
        write_json(task / 'manifest.json', manifest)
        (task / 'frames.csv').write_text(
            'task_frame,source_frame,source_timestamp_ms,image\n'
            '1,105,3500,000001.jpg\n2,106,3533.333,000002.jpg\n'
        )
        (task / 'seqinfo.ini').write_text(
            '[Sequence]\nname=test\nimDir=img1\nframeRate=30\nseqLength=2\n'
            'imWidth=100\nimHeight=80\nimExt=.jpg\n'
        )
        (task / 'seed' / 'seed.txt').write_text('1,7,10,20,20,35,.8,1,-1\n')
        (task / 'gt' / 'gt.txt').write_text(
            '1,1,10,20,20,35,1,1,1\n2,1,11,20,20,35,1,1,.9\n'
        )
        digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
        write_json(task / 'gt' / 'review.json', {
            'status': 'HUMAN_REVIEW_COMPLETE',
            'task_manifest_sha256': digest(task / 'manifest.json'),
            'gt_sha256': digest(task / 'gt' / 'gt.txt'),
            'reviewed_frames': 2,
            'reviewed_by': 'independent-reviewer',
            'reviewed_at': '2026-09-27T10:00:00-03:00',
        })
        return task

    def test_review_hash_mismatch_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            task = self.make_task(tmp)
            review = json.loads((task / 'gt' / 'review.json').read_text())
            review['gt_sha256'] = '0' * 64
            write_json(task / 'gt' / 'review.json', review)
            with self.assertRaisesRegex(ValueError, 'gt_sha256'):
                validate_review(task)

    def test_unreviewed_seed_visibility_is_not_valid_gt(self):
        with tempfile.TemporaryDirectory() as tmp:
            task = self.make_task(tmp)
            with self.assertRaisesRegex(ValueError, 'visibility'):
                read_ground_truth(
                    task / 'seed' / 'seed.txt', frames=2, width=100, height=80,
                )

    def test_builds_trackeval_layout_from_source_frame_mapping(self):
        with tempfile.TemporaryDirectory() as tmp:
            task = self.make_task(tmp)
            tracks = Path(tmp) / 'tracks.jsonl'
            with tracks.open('w') as stream:
                for frame, x in [(105, 10), (106, 11)]:
                    stream.write(json.dumps({
                        'schema': '7metros-ai.v1',
                        'frame_index': frame,
                        'timestamp_ms': frame * 1000 / 30,
                        'image': {'width': 100, 'height': 80},
                        'objects': [{
                            'track_id': 7, 'bbox_xyxy': [x, 20, x + 20, 55],
                            'confidence': .8, 'kind': 'player',
                        }],
                    }) + '\n')
            output = Path(tmp) / 'bundle'
            result = build(task, [('two_stage', tracks)], output)
            self.assertEqual(result['gt_rows'], 2)
            self.assertEqual(result['trackers']['two_stage']['rows'], 2)
            prediction = (
                output / 'trackers' / 'mot_challenge' / '7metros-train' /
                'two_stage' / 'data' / 'hard_reentry.txt'
            )
            with prediction.open(newline='') as stream:
                rows = list(csv.reader(stream))
            self.assertEqual(rows[0][:2], ['1', '7'])
            self.assertEqual(rows[1][:2], ['2', '7'])
            self.assertTrue((
                output / 'gt' / 'mot_challenge' / '7metros-train' /
                'hard_reentry' / 'gt' / 'gt.txt'
            ).is_file())
            self.assertEqual(
                (output / 'gt' / 'mot_challenge' / 'seqmaps' /
                 '7metros-train.txt').read_text(),
                'name\nhard_reentry\n',
            )


if __name__ == '__main__':
    unittest.main()

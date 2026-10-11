"""Import the compact human-review JSON into a MOT annotation task.

The importer binds the result to the expected reviewer-task manifest digest and
rejects incomplete review flags, invalid geometry and duplicate identities.
It does not establish annotation accuracy; that remains a human-review claim.
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime
import json
import math
from pathlib import Path

from prepare_mot_annotation import sha256_file


STATUS = 'HUMAN_REVIEW_COMPLETE'


def parse_id_correction(value):
    try:
        frame, old_id, new_id = (int(part) for part in value.split(':'))
    except (AttributeError, TypeError, ValueError) as exc:
        raise argparse.ArgumentTypeError('Use FRAME:OLD_ID:NEW_ID') from exc
    if frame <= 0 or old_id <= 0 or new_id <= 0 or old_id == new_id:
        raise argparse.ArgumentTypeError('Correction values must be distinct positive integers')
    return frame, old_id, new_id


def _timestamp(value):
    try:
        parsed = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except (TypeError, ValueError) as exc:
        raise ValueError('reviewed_at must be an ISO-8601 timestamp') from exc
    if parsed.tzinfo is None:
        raise ValueError('reviewed_at must include a timezone')
    return str(value)


def import_review(review_json, task, expected_manifest_sha256, id_corrections=()):
    review_json, task = Path(review_json), Path(task)
    payload = json.loads(review_json.read_text(encoding='utf-8'))
    manifest = json.loads((task / 'manifest.json').read_text(encoding='utf-8'))
    frames_path = task / 'frames.csv'
    if payload.get('version') != 2 or payload.get('status') != STATUS:
        raise ValueError('Unexpected reviewer JSON version or status')
    source = payload.get('manifest', {})
    if source.get('manifest_sha256') != expected_manifest_sha256:
        raise ValueError('Reviewer JSON does not match expected task manifest')
    frames = int(manifest['task_frames'])
    reviewed = payload.get('reviewed')
    if payload.get('reviewed_frames') != frames or reviewed != [True] * frames:
        raise ValueError('Every task frame must be explicitly reviewed')
    boxes = payload.get('boxes')
    if not isinstance(boxes, list) or len(boxes) != frames:
        raise ValueError('Reviewer box frame count differs from task')
    width, height = int(manifest['width']), int(manifest['height'])
    expected = {
        'frames': frames, 'fps': float(manifest['fps']),
        'width': width, 'height': height,
        'seed_boxes': int(manifest['proposal_boxes']),
        'source_fixture_frames': [
            int(manifest['source_start_frame']),
            int(manifest['source_end_frame_exclusive']) - 1,
        ],
    }
    for field, value in expected.items():
        actual = source.get(field)
        if field == 'fps':
            if not math.isclose(float(actual), value):
                raise ValueError(f'Reviewer manifest differs at {field}')
        elif actual != value:
            raise ValueError(f'Reviewer manifest differs at {field}')
    if not frames_path.is_file() or sha256_file(frames_path) != manifest['frames_csv_sha256']:
        raise ValueError('Task frame mapping hash mismatch')

    corrections = {}
    for correction in id_corrections:
        frame, old_id, new_id = correction
        if (frame, old_id) in corrections or frame > frames:
            raise ValueError('Invalid or duplicate identity correction')
        corrections[frame, old_id] = new_id
    correction_hits = {key: 0 for key in corrections}
    rows = []
    for frame, objects in enumerate(boxes, 1):
        if not isinstance(objects, list):
            raise ValueError(f'Frame {frame} boxes must be a list')
        identities = set()
        for item in objects:
            identity = item.get('id')
            if not isinstance(identity, int) or isinstance(identity, bool) or identity <= 0:
                raise ValueError(f'Frame {frame} has invalid identity')
            correction_key = frame, identity
            if correction_key in corrections:
                correction_hits[correction_key] += 1
                identity = corrections[correction_key]
            if identity in identities:
                raise ValueError(f'Duplicate identity {identity} in frame {frame}')
            identities.add(identity)
            try:
                x, y, box_width, box_height = (
                    float(item[key]) for key in ('x', 'y', 'w', 'h')
                )
                visibility = float(item.get('visibility', 1))
            except (KeyError, TypeError, ValueError) as exc:
                raise ValueError(f'Frame {frame} has invalid box values') from exc
            values = (x, y, box_width, box_height, visibility)
            if not all(math.isfinite(value) for value in values):
                raise ValueError(f'Frame {frame} contains non-finite values')
            if not (0 <= x < x + box_width <= width and
                    0 <= y < y + box_height <= height):
                raise ValueError(f'Frame {frame} has out-of-bounds box')
            if not 0 <= visibility <= 1:
                raise ValueError(f'Frame {frame} has invalid visibility')
            rows.append([
                frame, identity, x, y, box_width, box_height, 1, 1, visibility,
            ])
    if not rows:
        raise ValueError('Reviewed ground truth is empty')
    if any(hits != 1 for hits in correction_hits.values()):
        raise ValueError('Every identity correction must match exactly one box')
    reviewed_by = str(payload.get('reviewed_by', '')).strip()
    if not reviewed_by:
        raise ValueError('reviewed_by must be nonempty')
    reviewed_at = _timestamp(payload.get('reviewed_at'))
    gt_dir = task / 'gt'
    if gt_dir.exists():
        raise ValueError(f'Ground-truth directory already exists: {gt_dir}')
    gt_dir.mkdir()
    gt_path = gt_dir / 'gt.txt'
    with gt_path.open('w', newline='', encoding='utf-8') as stream:
        csv.writer(stream).writerows(rows)
    attestation = {
        'status': STATUS,
        'task_manifest_sha256': sha256_file(task / 'manifest.json'),
        'source_task_manifest_sha256': expected_manifest_sha256,
        'source_review_json_sha256': sha256_file(review_json),
        'id_corrections': [
            {'task_frame': frame, 'from_id': old_id, 'to_id': new_id}
            for (frame, old_id), new_id in sorted(corrections.items())
        ],
        'gt_sha256': sha256_file(gt_path),
        'reviewed_frames': frames,
        'reviewed_by': reviewed_by,
        'reviewed_at': reviewed_at,
    }
    (gt_dir / 'review.json').write_text(
        json.dumps(attestation, indent=2) + '\n', encoding='utf-8',
    )
    return {**attestation, 'gt_rows': len(rows)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--review-json', required=True)
    parser.add_argument('--task', required=True)
    parser.add_argument('--expected-manifest-sha256', required=True)
    parser.add_argument(
        '--id-correction', dest='id_corrections', action='append',
        type=parse_id_correction, default=[], metavar='FRAME:OLD_ID:NEW_ID',
    )
    print(json.dumps(import_review(**vars(parser.parse_args())), indent=2))


if __name__ == '__main__':
    main()

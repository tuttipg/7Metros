"""Build a TrackEval MOTChallenge bundle from reviewed annotations and JSONL tracks.

This tool validates review provenance and geometry, but cannot prove that a
human annotation is correct.  It deliberately rejects the unreviewed seed.
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime
import json
import math
from pathlib import Path
import re
import shutil

from prepare_mot_annotation import ensure_new_output, sha256_file, validate_object


REVIEW_STATUS = 'HUMAN_REVIEW_COMPLETE'
SEQUENCE = 'ferro_lujan_contact'
BENCHMARK = '7metros'
SPLIT = 'train'


def parse_track_spec(value):
    if '=' not in value:
        raise argparse.ArgumentTypeError('Use LABEL=PATH for every --tracks value')
    label, path = value.split('=', 1)
    label = label.strip()
    if not label or not path.strip():
        raise argparse.ArgumentTypeError('Tracker label and path must be nonempty')
    safe = re.sub(r'[^A-Za-z0-9_.-]+', '_', label).strip('_.-')
    if not safe:
        raise argparse.ArgumentTypeError('Tracker label has no filesystem-safe characters')
    return safe, Path(path.strip())


def read_json(path):
    with Path(path).open(encoding='utf-8') as stream:
        return json.load(stream)


def validate_review(task):
    task = Path(task)
    required = [
        task / 'manifest.json', task / 'frames.csv', task / 'seqinfo.ini',
        task / 'seed' / 'seed.txt', task / 'gt' / 'gt.txt',
        task / 'gt' / 'review.json',
    ]
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise ValueError(f'Missing annotation task file: {missing[0]}')
    manifest = read_json(task / 'manifest.json')
    review = read_json(task / 'gt' / 'review.json')
    if manifest.get('status') != 'UNVERIFIED_TRACKER_PROPOSAL_NOT_GROUND_TRUTH':
        raise ValueError('Unexpected source task status')
    checks = {
        'status': REVIEW_STATUS,
        'task_manifest_sha256': sha256_file(task / 'manifest.json'),
        'gt_sha256': sha256_file(task / 'gt' / 'gt.txt'),
        'reviewed_frames': manifest.get('task_frames'),
    }
    for field, expected in checks.items():
        if review.get(field) != expected:
            raise ValueError(f'Invalid review attestation field: {field}')
    if not str(review.get('reviewed_by', '')).strip():
        raise ValueError('reviewed_by must be nonempty')
    try:
        reviewed_at = datetime.fromisoformat(str(review['reviewed_at']).replace('Z', '+00:00'))
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError('reviewed_at must be an ISO-8601 timestamp') from exc
    if reviewed_at.tzinfo is None:
        raise ValueError('reviewed_at must include a timezone')
    return manifest, review


def read_frames(task, expected_count):
    with (Path(task) / 'frames.csv').open(newline='', encoding='utf-8') as stream:
        rows = list(csv.DictReader(stream))
    if len(rows) != expected_count:
        raise ValueError('frames.csv length differs from manifest')
    mapping = []
    for expected, row in enumerate(rows, 1):
        task_frame = int(row['task_frame'])
        source_frame = int(row['source_frame'])
        if task_frame != expected or source_frame < 0:
            raise ValueError('frames.csv must be contiguous and one-based')
        mapping.append((task_frame, source_frame))
    return mapping


def read_ground_truth(path, *, frames, width, height):
    rows = []
    seen = set()
    with Path(path).open(newline='', encoding='utf-8') as stream:
        for line_number, row in enumerate(csv.reader(stream), 1):
            if len(row) != 9:
                raise ValueError(f'GT line {line_number} must have 9 columns')
            values = [float(value) for value in row]
            if not all(math.isfinite(value) for value in values):
                raise ValueError(f'GT line {line_number} contains non-finite values')
            frame, identity = values[0], values[1]
            if not frame.is_integer() or not identity.is_integer():
                raise ValueError(f'GT line {line_number} frame/id must be integers')
            frame, identity = int(frame), int(identity)
            x, y, box_width, box_height = values[2:6]
            mark, class_id, visibility = values[6:9]
            if not 1 <= frame <= frames or identity <= 0:
                raise ValueError(f'GT line {line_number} frame/id out of range')
            if (frame, identity) in seen:
                raise ValueError(f'Duplicate GT identity {identity} in frame {frame}')
            if not (0 <= x < x + box_width <= width and
                    0 <= y < y + box_height <= height):
                raise ValueError(f'GT line {line_number} box out of bounds')
            if mark != 1 or class_id != 1 or not 0 <= visibility <= 1:
                raise ValueError(
                    f'GT line {line_number} requires mark=1, class=1, visibility=[0,1]'
                )
            seen.add((frame, identity))
            rows.append(row)
    if not rows:
        raise ValueError('Ground truth is empty')
    return rows


def load_tracker_frames(path, source_frames):
    wanted = set(source_frames)
    rows = {}
    with Path(path).open(encoding='utf-8') as stream:
        for line_number, line in enumerate(stream, 1):
            payload = json.loads(line)
            source_frame = payload.get('frame_index')
            if source_frame in wanted:
                if source_frame in rows:
                    raise ValueError(
                        f'Tracker {path} repeats frame {source_frame} at line {line_number}'
                    )
                rows[source_frame] = payload
    return rows


def tracker_rows(path, mapping, *, width, height, fps):
    source_frames = [source for _, source in mapping]
    window = load_tracker_frames(path, source_frames)
    rows = []
    for task_frame, source_frame in mapping:
        if source_frame not in window:
            raise ValueError(f'Tracker {path} misses source frame {source_frame}')
        payload = window[source_frame]
        if payload.get('schema') != '7metros-ai.v1':
            raise ValueError(f'Tracker schema mismatch at {source_frame}')
        if payload.get('frame_index') != source_frame:
            raise ValueError(f'Tracker frame mismatch at {source_frame}')
        if payload.get('image') != {'width': width, 'height': height}:
            raise ValueError(f'Tracker dimension mismatch at {source_frame}')
        expected_ms = source_frame * 1000.0 / fps
        if abs(float(payload.get('timestamp_ms', -1)) - expected_ms) > 1:
            raise ValueError(f'Tracker timestamp mismatch at {source_frame}')
        ids = set()
        for observation in payload.get('objects', []):
            x1, y1, x2, y2 = validate_object(observation, width, height)
            identity = int(observation['track_id'])
            if identity in ids:
                raise ValueError(f'Duplicate tracker ID {identity} at {source_frame}')
            ids.add(identity)
            rows.append([
                task_frame, identity, round(x1, 3), round(y1, 3),
                round(x2 - x1, 3), round(y2 - y1, 3),
                round(float(observation['confidence']), 6), -1, -1, -1,
            ])
    return rows


def write_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', newline='', encoding='utf-8') as stream:
        csv.writer(stream).writerows(rows)


def build(task, track_specs, output):
    if not track_specs:
        raise ValueError('At least one tracker is required')
    labels = [label for label, _ in track_specs]
    if len(labels) != len(set(labels)):
        raise ValueError('Tracker labels must be unique after normalization')
    task, output = Path(task), Path(output)
    manifest, review = validate_review(task)
    sequence = manifest.get('sequence', SEQUENCE)
    if not isinstance(sequence, str) or not re.fullmatch(r'[A-Za-z0-9_.-]+', sequence):
        raise ValueError('Manifest sequence must be filesystem-safe')
    frame_count = int(manifest['task_frames'])
    width, height = int(manifest['width']), int(manifest['height'])
    fps = float(manifest['fps'])
    if not math.isfinite(fps) or fps <= 0:
        raise ValueError('Manifest FPS must be positive and finite')
    mapping = read_frames(task, frame_count)
    gt_rows = read_ground_truth(
        task / 'gt' / 'gt.txt', frames=frame_count, width=width, height=height,
    )
    tracker_data = {}
    for label, path in track_specs:
        tracker_data[label] = (path, tracker_rows(
            path, mapping, width=width, height=height, fps=fps,
        ))
    output = ensure_new_output(output)
    dataset = f'{BENCHMARK}-{SPLIT}'
    gt_dir = output / 'gt' / 'mot_challenge' / dataset / sequence
    (gt_dir / 'gt').mkdir(parents=True)
    shutil.copyfile(task / 'gt' / 'gt.txt', gt_dir / 'gt' / 'gt.txt')
    shutil.copyfile(task / 'seqinfo.ini', gt_dir / 'seqinfo.ini')

    tracker_stats = {}
    for label, (path, rows) in tracker_data.items():
        destination = (
            output / 'trackers' / 'mot_challenge' / dataset /
            label / 'data' / f'{sequence}.txt'
        )
        write_csv(destination, rows)
        tracker_stats[label] = {
            'source': Path(path).name,
            'source_sha256': sha256_file(path),
            'rows': len(rows),
            'mot_sha256': sha256_file(destination),
        }

    seqmap = output / 'gt' / 'mot_challenge' / 'seqmaps' / f'{dataset}.txt'
    seqmap.parent.mkdir()
    seqmap.write_text(f'name\n{sequence}\n', encoding='utf-8')
    result = {
        'status': 'STRUCTURALLY_VALID_REVIEW_ATTESTATION_NOT_ACCURACY_PROOF',
        'sequence': sequence,
        'dataset': dataset,
        'frames': frame_count,
        'gt_rows': len(gt_rows),
        'gt_sha256': sha256_file(task / 'gt' / 'gt.txt'),
        'reviewed_by': review['reviewed_by'],
        'reviewed_at': review['reviewed_at'],
        'trackers': tracker_stats,
    }
    (output / 'bundle_manifest.json').write_text(
        json.dumps(result, indent=2) + '\n', encoding='utf-8',
    )
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--task', required=True)
    parser.add_argument(
        '--tracks', dest='track_specs', action='append',
        type=parse_track_spec, required=True,
    )
    parser.add_argument('--output', required=True)
    print(json.dumps(build(**vars(parser.parse_args())), indent=2))


if __name__ == '__main__':
    main()

"""Rank MOT task frames by tracker disagreement for mandatory human review.

The queue only prioritizes work. Agreement between automatic trackers is not
ground truth, so every frame still requires independent review before metrics.
"""
from __future__ import annotations

import argparse
import csv
from itertools import combinations
import json
import math
from pathlib import Path

from prepare_mot_annotation import sha256_file, validate_object
from prepare_trackeval_bundle import parse_track_spec, read_frames, read_json


STATUS = 'UNVERIFIED_PRIORITY_QUEUE_NOT_GROUND_TRUTH'


def box_iou(first, second):
    ax1, ay1, ax2, ay2 = first
    bx1, by1, bx2, by2 = second
    width = max(0.0, min(ax2, bx2) - max(ax1, bx1))
    height = max(0.0, min(ay2, by2) - max(ay1, by1))
    intersection = width * height
    if intersection <= 0:
        return 0.0
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    return intersection / (area_a + area_b - intersection)


def greedy_matches(first, second, threshold):
    candidates = sorted(
        (
            (box_iou(a, b), first_index, second_index)
            for first_index, a in enumerate(first)
            for second_index, b in enumerate(second)
        ),
        reverse=True,
    )
    used_first, used_second, overlaps = set(), set(), []
    for overlap, first_index, second_index in candidates:
        if overlap < threshold:
            break
        if first_index in used_first or second_index in used_second:
            continue
        used_first.add(first_index)
        used_second.add(second_index)
        overlaps.append(overlap)
    return overlaps


def load_tracker_window(path, source_frames, width, height):
    wanted = set(source_frames)
    result = {}
    with Path(path).open(encoding='utf-8') as stream:
        for line_number, line in enumerate(stream, 1):
            row = json.loads(line)
            frame = row.get('frame_index')
            if frame not in wanted:
                continue
            if frame in result:
                raise ValueError(f'{path} repeats frame {frame} at line {line_number}')
            if row.get('image') != {'width': width, 'height': height}:
                raise ValueError(f'{path} dimension mismatch at frame {frame}')
            ids, boxes = set(), []
            for observation in row.get('objects', []):
                identity = int(observation['track_id'])
                if identity in ids:
                    raise ValueError(f'{path} repeats ID {identity} at frame {frame}')
                ids.add(identity)
                boxes.append(validate_object(observation, width, height))
            result[frame] = {'ids': ids, 'boxes': boxes}
    missing = sorted(wanted - result.keys())
    if missing:
        raise ValueError(f'{path} misses source frame {missing[0]}')
    return result


def rank_frames(mapping, trackers, threshold):
    previous_ids = {label: None for label in trackers}
    result = []
    for task_frame, source_frame in mapping:
        counts = {}
        transitions = {}
        for label, rows in trackers.items():
            current = rows[source_frame]['ids']
            counts[label] = len(current)
            previous = previous_ids[label]
            transitions[label] = 0 if previous is None else len(
                current - previous,
            ) + len(previous - current)
            previous_ids[label] = current

        pairwise = {}
        geometric_disagreement = 0
        for first, second in combinations(trackers, 2):
            first_boxes = trackers[first][source_frame]['boxes']
            second_boxes = trackers[second][source_frame]['boxes']
            overlaps = greedy_matches(first_boxes, second_boxes, threshold)
            unmatched = len(first_boxes) + len(second_boxes) - 2 * len(overlaps)
            geometric_disagreement += unmatched
            pairwise[f'{first}__{second}'] = {
                'matched_boxes': len(overlaps),
                'unmatched_boxes': unmatched,
                'mean_matched_iou': (
                    round(sum(overlaps) / len(overlaps), 6) if overlaps else None
                ),
            }
        transition_spread = max(transitions.values()) - min(transitions.values())
        score = geometric_disagreement + transition_spread
        result.append({
            'task_frame': task_frame,
            'source_frame': source_frame,
            'priority_score': score,
            'geometric_disagreement': geometric_disagreement,
            'transition_event_spread': transition_spread,
            'object_counts': counts,
            'transition_events': transitions,
            'pairwise': pairwise,
        })
    return sorted(result, key=lambda row: (-row['priority_score'], row['task_frame']))


def build(task, track_specs, output, iou_threshold=.5):
    if len(track_specs) < 2:
        raise ValueError('At least two trackers are required')
    if not 0 < iou_threshold <= 1 or not math.isfinite(iou_threshold):
        raise ValueError('iou_threshold must be finite and in (0,1]')
    labels = [label for label, _ in track_specs]
    if len(labels) != len(set(labels)):
        raise ValueError('Tracker labels must be unique')

    task, output = Path(task), Path(output)
    if output.exists():
        raise ValueError(f'Output already exists: {output}')
    manifest = read_json(task / 'manifest.json')
    if manifest.get('status') != 'UNVERIFIED_TRACKER_PROPOSAL_NOT_GROUND_TRUTH':
        raise ValueError('Unexpected annotation task status')
    if sha256_file(task / 'frames.csv') != manifest.get('frames_csv_sha256'):
        raise ValueError('frames.csv hash differs from task manifest')
    frame_count = int(manifest['task_frames'])
    width, height = int(manifest['width']), int(manifest['height'])
    mapping = read_frames(task, frame_count)
    source_frames = [source for _, source in mapping]
    trackers = {
        label: load_tracker_window(path, source_frames, width, height)
        for label, path in track_specs
    }
    frames = rank_frames(mapping, trackers, iou_threshold)
    positive = sum(frame['priority_score'] > 0 for frame in frames)
    payload = {
        'status': STATUS,
        'metrics_allowed': False,
        'all_frames_still_require_human_review': True,
        'task_manifest_sha256': sha256_file(task / 'manifest.json'),
        'frames_csv_sha256': sha256_file(task / 'frames.csv'),
        'trackers': {
            label: {'source': Path(path).name, 'sha256': sha256_file(path)}
            for label, path in track_specs
        },
        'iou_threshold': iou_threshold,
        'matching': 'deterministic greedy descending IoU; prioritization only',
        'frames': frame_count,
        'frames_with_nonzero_priority': positive,
        'frames_with_zero_priority': frame_count - positive,
        'queue': frames,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
    csv_path = output.with_suffix('.csv')
    with csv_path.open('w', newline='', encoding='utf-8') as stream:
        writer = csv.writer(stream)
        writer.writerow([
            'rank', 'task_frame', 'source_frame', 'priority_score',
            'geometric_disagreement', 'transition_event_spread',
        ])
        for rank, frame in enumerate(frames, 1):
            writer.writerow([
                rank, frame['task_frame'], frame['source_frame'],
                frame['priority_score'], frame['geometric_disagreement'],
                frame['transition_event_spread'],
            ])
    payload['queue_csv_sha256'] = sha256_file(csv_path)
    output.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
    return payload


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--task', required=True)
    parser.add_argument(
        '--tracks', dest='track_specs', action='append',
        type=parse_track_spec, required=True,
    )
    parser.add_argument('--output', required=True)
    parser.add_argument('--iou-threshold', type=float, default=.5)
    print(json.dumps(build(**vars(parser.parse_args())), indent=2))


if __name__ == '__main__':
    main()

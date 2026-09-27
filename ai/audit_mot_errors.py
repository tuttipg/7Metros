"""Attribute MOT detection errors and identity fragmentation to frames and IDs.

This complements TrackEval's aggregate metrics. Matching is one-to-one at a
fixed IoU threshold and is used only for diagnostics, never as a replacement
for official HOTA, CLEAR or Identity metrics.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import csv
import json
import math
from pathlib import Path

from prepare_mot_annotation import sha256_file
from prepare_trackeval_bundle import parse_track_spec
from prepare_mot_review_queue import box_iou


def read_mot(path, *, frames):
    result = defaultdict(list)
    seen = set()
    with Path(path).open(newline='', encoding='utf-8') as stream:
        for line_number, row in enumerate(csv.reader(stream), 1):
            if len(row) not in (9, 10):
                raise ValueError(f'{path} line {line_number} must have 9 or 10 columns')
            values = [float(value) for value in row[:6]]
            if not all(math.isfinite(value) for value in values):
                raise ValueError(f'{path} line {line_number} contains non-finite values')
            frame_value, identity_value, x, y, width, height = values
            if not frame_value.is_integer() or not identity_value.is_integer():
                raise ValueError(f'{path} line {line_number} frame/id must be integers')
            frame, identity = int(frame_value), int(identity_value)
            if not 1 <= frame <= frames or identity <= 0:
                raise ValueError(f'{path} line {line_number} frame/id out of range')
            if width <= 0 or height <= 0:
                raise ValueError(f'{path} line {line_number} has a degenerate box')
            if (frame, identity) in seen:
                raise ValueError(f'{path} repeats ID {identity} in frame {frame}')
            seen.add((frame, identity))
            result[frame].append({
                'id': identity,
                'box': (x, y, x + width, y + height),
            })
    return {frame: result[frame] for frame in range(1, frames + 1)}


def match_frame(ground_truth, tracker, threshold):
    try:
        import numpy as np
        from scipy.optimize import linear_sum_assignment
    except ImportError as exc:
        raise RuntimeError('SciPy is required for MOT error matching') from exc
    if not ground_truth or not tracker:
        return []
    overlaps = np.asarray([
        [box_iou(gt['box'], observation['box']) for observation in tracker]
        for gt in ground_truth
    ])
    # The large valid-edge bonus maximizes match cardinality first; IoU then
    # breaks ties. Invalid assignments are discarded after the rectangular
    # Hungarian solve.
    scores = np.where(overlaps >= threshold, 1_000_000 + overlaps, 0)
    gt_indexes, tracker_indexes = linear_sum_assignment(scores, maximize=True)
    return [
        (int(gt_index), int(tracker_index), float(overlaps[gt_index, tracker_index]))
        for gt_index, tracker_index in zip(gt_indexes, tracker_indexes)
        if overlaps[gt_index, tracker_index] >= threshold
    ]


def audit_tracker(ground_truth, tracker, *, frames, threshold):
    totals = Counter()
    missed_gt_ids = Counter()
    false_positive_track_ids = Counter()
    identity_pairs = Counter()
    identity_presence = Counter()
    identity_matches = Counter()
    frame_rows = []
    overlaps = []
    for frame in range(1, frames + 1):
        gt_rows, tracker_rows = ground_truth[frame], tracker[frame]
        matches = match_frame(gt_rows, tracker_rows, threshold)
        matched_gt = {gt_index for gt_index, _, _ in matches}
        matched_tracker = {tracker_index for _, tracker_index, _ in matches}
        tp = len(matches)
        fn, fp = len(gt_rows) - tp, len(tracker_rows) - tp
        totals.update(TP=tp, FN=fn, FP=fp)
        overlaps.extend(overlap for _, _, overlap in matches)
        for gt_index, row in enumerate(gt_rows):
            identity_presence[row['id']] += 1
            if gt_index in matched_gt:
                identity_matches[row['id']] += 1
            else:
                missed_gt_ids[row['id']] += 1
        for tracker_index, row in enumerate(tracker_rows):
            if tracker_index not in matched_tracker:
                false_positive_track_ids[row['id']] += 1
        for gt_index, tracker_index, _ in matches:
            identity_pairs[(gt_rows[gt_index]['id'], tracker_rows[tracker_index]['id'])] += 1
        frame_rows.append({
            'frame': frame, 'TP': tp, 'FN': fn, 'FP': fp,
            'errors': fn + fp,
        })
    by_gt = {}
    for identity in sorted(identity_presence):
        present, matched = identity_presence[identity], identity_matches[identity]
        pairs = sorted(
            (
                {'tracker_id': tracker_id, 'frames': count}
                for (gt_id, tracker_id), count in identity_pairs.items()
                if gt_id == identity
            ),
            key=lambda row: (-row['frames'], row['tracker_id']),
        )
        by_gt[str(identity)] = {
            'present_frames': present,
            'matched_frames': matched,
            'recall_percent': round(100 * matched / present, 6),
            'matched_tracker_ids': pairs,
        }
    return {
        'TP': totals['TP'], 'FN': totals['FN'], 'FP': totals['FP'],
        'frames_with_FN': sum(row['FN'] > 0 for row in frame_rows),
        'frames_with_FP': sum(row['FP'] > 0 for row in frame_rows),
        'frames_without_FN': sum(row['FN'] == 0 for row in frame_rows),
        'mean_matched_iou': round(sum(overlaps) / len(overlaps), 6),
        'missed_gt_ids': dict(sorted(missed_gt_ids.items())),
        'false_positive_track_ids': dict(sorted(false_positive_track_ids.items())),
        'gt_identity_diagnostics': by_gt,
        'worst_frames': sorted(
            frame_rows, key=lambda row: (-row['errors'], -row['FN'], row['frame']),
        )[:10],
    }


def verify_trackeval_counts(result, expected):
    expected_payload = json.loads(Path(expected).read_text(encoding='utf-8'))
    expected_metrics = expected_payload.get('metrics_percent_except_counts', {})
    for label, audit in result['trackers'].items():
        official = expected_metrics.get(label)
        if official is None:
            raise ValueError(f'Missing expected TrackEval tracker: {label}')
        for field in ('TP', 'FN', 'FP'):
            if audit[field] != official.get(field):
                raise ValueError(
                    f'{label} {field} differs from TrackEval: '
                    f"{audit[field]} != {official.get(field)}"
                )
    result['trackeval_count_verification'] = 'MATCH'


def build(gt, track_specs, output, *, frames, iou_threshold=.5,
          baseline=None, expected_trackeval=None):
    if frames <= 0:
        raise ValueError('frames must be positive')
    if not 0 < iou_threshold <= 1 or not math.isfinite(iou_threshold):
        raise ValueError('iou_threshold must be finite and in (0,1]')
    labels = [label for label, _ in track_specs]
    if not labels or len(labels) != len(set(labels)):
        raise ValueError('Tracker labels must be present and unique')
    if baseline is not None and baseline not in labels:
        raise ValueError('baseline must name one of the trackers')
    output = Path(output)
    if output.exists():
        raise ValueError(f'Output already exists: {output}')
    ground_truth = read_mot(gt, frames=frames)
    trackers = {
        label: audit_tracker(
            ground_truth, read_mot(path, frames=frames),
            frames=frames, threshold=iou_threshold,
        )
        for label, path in track_specs
    }
    result = {
        'status': 'DIAGNOSTIC_MATCHING_NOT_A_REPLACEMENT_FOR_TRACKEVAL',
        'scope': 'persisted_tracker_replay_against_human_reviewed_gt',
        'frames': frames,
        'iou_threshold': iou_threshold,
        'matching': 'maximum-cardinality Hungarian; IoU tie-break',
        'gt_sha256': sha256_file(gt),
        'tracker_sha256': {
            label: sha256_file(path) for label, path in track_specs
        },
        'trackers': trackers,
    }
    if baseline is not None:
        base = trackers[baseline]
        result['delta_vs_baseline'] = {
            label: {
                field: metrics[field] - base[field]
                for field in ('TP', 'FN', 'FP', 'frames_without_FN')
            }
            for label, metrics in trackers.items() if label != baseline
        }
    if expected_trackeval is not None:
        verify_trackeval_counts(result, expected_trackeval)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gt', required=True)
    parser.add_argument('--tracks', dest='track_specs', action='append',
                        type=parse_track_spec, required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--frames', type=int, required=True)
    parser.add_argument('--iou-threshold', type=float, default=.5)
    parser.add_argument('--baseline')
    parser.add_argument('--expected-trackeval')
    print(json.dumps(build(**vars(parser.parse_args())), indent=2))


if __name__ == '__main__':
    main()

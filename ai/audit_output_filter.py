"""Verify that an output-only filter removes no GT-matched observations.

This is a diagnostic guardrail for persisted tracker replay. It verifies that
the candidate output is a strict subset of the control output, then repeats the
same one-to-one IoU matching on both streams. It does not replace TrackEval.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
import math
from pathlib import Path

from audit_mot_errors import match_frame, read_mot
from prepare_mot_annotation import sha256_file
from prepare_trackeval_bundle import parse_track_spec
from prepare_mot_review_queue import box_iou


def _row_key(row):
    return row['id'], tuple(row['box'])


def _frame_ranges(frames):
    ranges = []
    for frame in frames:
        if not ranges or frame != ranges[-1][1] + 1:
            ranges.append([frame, frame])
        else:
            ranges[-1][1] = frame
    return ranges


def audit_tracker(ground_truth, before, after, *, frames, threshold):
    totals = Counter()
    removed_track_ids = Counter()
    removed_gt_ids = Counter()
    risky_overlap_gt_ids = Counter()
    affected_frames = []
    for frame in range(1, frames + 1):
        gt_rows = ground_truth[frame]
        before_rows = before[frame]
        after_rows = after[frame]
        before_keys = {_row_key(row) for row in before_rows}
        after_keys = {_row_key(row) for row in after_rows}
        added = after_keys - before_keys
        if added:
            raise ValueError(
                f'Candidate output adds or changes {len(added)} observation(s) '
                f'at frame {frame}; this is not an output-only filter'
            )
        removed_indexes = {
            index for index, row in enumerate(before_rows)
            if _row_key(row) not in after_keys
        }
        before_matches = match_frame(gt_rows, before_rows, threshold)
        after_matches = match_frame(gt_rows, after_rows, threshold)
        before_matched_trackers = {
            tracker_index: gt_index
            for gt_index, tracker_index, _ in before_matches
        }
        removed_matches = {
            tracker_index: gt_index
            for tracker_index, gt_index in before_matched_trackers.items()
            if tracker_index in removed_indexes
        }
        risky = []
        for tracker_index in removed_indexes:
            row = before_rows[tracker_index]
            removed_track_ids[row['id']] += 1
            for gt_index, gt in enumerate(gt_rows):
                if box_iou(row['box'], gt['box']) >= threshold:
                    risky.append((tracker_index, gt_index))
                    risky_overlap_gt_ids[gt['id']] += 1
        for gt_index in removed_matches.values():
            removed_gt_ids[gt_rows[gt_index]['id']] += 1
        before_tp, after_tp = len(before_matches), len(after_matches)
        totals.update(
            before_observations=len(before_rows),
            after_observations=len(after_rows),
            removed_observations=len(removed_indexes),
            before_TP=before_tp,
            after_TP=after_tp,
            before_FN=len(gt_rows) - before_tp,
            after_FN=len(gt_rows) - after_tp,
            before_FP=len(before_rows) - before_tp,
            after_FP=len(after_rows) - after_tp,
            removed_matched_before=len(removed_matches),
            removed_with_gt_overlap=len({index for index, _ in risky}),
        )
        if removed_indexes:
            affected_frames.append(frame)

    safe = (
        totals['removed_matched_before'] == 0
        and totals['removed_with_gt_overlap'] == 0
        and totals['after_TP'] == totals['before_TP']
        and totals['after_FN'] == totals['before_FN']
        and totals['after_FP'] <= totals['before_FP']
    )
    return {
        'status': (
            'REMOVED_ONLY_FALSE_POSITIVES_ON_REVIEWED_GT'
            if safe else 'GT_MATCH_REMOVAL_DETECTED'
        ),
        'before_observations': totals['before_observations'],
        'after_observations': totals['after_observations'],
        'removed_observations': totals['removed_observations'],
        'before': {
            'TP': totals['before_TP'], 'FN': totals['before_FN'],
            'FP': totals['before_FP'],
        },
        'after': {
            'TP': totals['after_TP'], 'FN': totals['after_FN'],
            'FP': totals['after_FP'],
        },
        'removed_matched_before': totals['removed_matched_before'],
        'removed_with_any_gt_overlap': totals['removed_with_gt_overlap'],
        'removed_track_ids': dict(sorted(removed_track_ids.items())),
        'removed_gt_ids': dict(sorted(removed_gt_ids.items())),
        'risky_overlap_gt_ids': dict(sorted(risky_overlap_gt_ids.items())),
        'affected_frame_count': len(affected_frames),
        'affected_frame_ranges': _frame_ranges(affected_frames),
    }


def _spec_map(specs, name):
    result = dict(specs)
    if not result or len(result) != len(specs):
        raise ValueError(f'{name} tracker labels must be present and unique')
    return result


def build(gt, before_specs, after_specs, output, *, frames, iou_threshold=.5,
          require_safe=False):
    if frames <= 0:
        raise ValueError('frames must be positive')
    if not 0 < iou_threshold <= 1 or not math.isfinite(iou_threshold):
        raise ValueError('iou_threshold must be finite and in (0,1]')
    before_paths = _spec_map(before_specs, 'before')
    after_paths = _spec_map(after_specs, 'after')
    if before_paths.keys() != after_paths.keys():
        raise ValueError('before and after tracker labels must match exactly')
    output = Path(output)
    if output.exists():
        raise ValueError(f'Output already exists: {output}')
    ground_truth = read_mot(gt, frames=frames)
    trackers = {}
    for label in before_paths:
        trackers[label] = audit_tracker(
            ground_truth,
            read_mot(before_paths[label], frames=frames),
            read_mot(after_paths[label], frames=frames),
            frames=frames,
            threshold=iou_threshold,
        )
    safe = all(
        tracker['status'] == 'REMOVED_ONLY_FALSE_POSITIVES_ON_REVIEWED_GT'
        for tracker in trackers.values()
    )
    result = {
        'status': (
            'OUTPUT_FILTER_VERIFIED_ON_REVIEWED_GT'
            if safe else 'OUTPUT_FILTER_GT_LOSS_DETECTED'
        ),
        'scope': 'persisted_tracker_replay_against_human_reviewed_gt',
        'accuracy_scope': 'this reviewed interval only; not general precision',
        'frames': frames,
        'iou_threshold': iou_threshold,
        'matching': 'maximum-cardinality Hungarian; IoU tie-break',
        'gt_sha256': sha256_file(gt),
        'before_sha256': {
            label: sha256_file(path) for label, path in before_paths.items()
        },
        'after_sha256': {
            label: sha256_file(path) for label, path in after_paths.items()
        },
        'trackers': trackers,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    if require_safe and not safe:
        raise RuntimeError('Output filter removed or overlapped a GT observation')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gt', required=True)
    parser.add_argument('--before', dest='before_specs', action='append',
                        type=parse_track_spec, required=True)
    parser.add_argument('--after', dest='after_specs', action='append',
                        type=parse_track_spec, required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--frames', type=int, required=True)
    parser.add_argument('--iou-threshold', type=float, default=.5)
    parser.add_argument('--require-safe', action='store_true')
    print(json.dumps(build(**vars(parser.parse_args())), indent=2))


if __name__ == '__main__':
    main()

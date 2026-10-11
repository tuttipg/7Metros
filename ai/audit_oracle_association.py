"""Audit tracker association using human GT boxes as oracle detections.

Ground-truth identities are hidden from the tracker. The tool asks a narrow
question: if localization/detection were perfect, would the association logic
itself create identity switches? This is diagnostic only and is not TrackEval.
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

from sevenmetros_ai.tracking import CentroidTracker, Detection, bbox_iou


def load_mot_gt(path):
    frames = defaultdict(list)
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        values = line.split(',')
        if len(values) < 6:
            raise ValueError('GT rows require at least 6 columns')
        frame, identity = int(values[0]), int(values[1])
        x, y, width, height = map(float, values[2:6])
        if frame <= 0 or identity <= 0 or width <= 0 or height <= 0:
            raise ValueError('Invalid MOT GT row')
        frames[frame].append((identity, Detection(
            x1=x, y1=y, x2=x + width, y2=y + height,
            confidence=1.0, label='player',
        )))
    if not frames:
        raise ValueError('Empty GT')
    if sorted(frames) != list(range(1, max(frames) + 1)):
        raise ValueError('GT frames must be contiguous and 1-based')
    return [frames[index] for index in range(1, max(frames) + 1)]


def _match(gt, tracks, iou_threshold=.5):
    candidates = []
    for gt_index, (_, box) in enumerate(gt):
        for track_index, track in enumerate(tracks):
            overlap = bbox_iou(box, track.detection)
            if overlap >= iou_threshold:
                candidates.append((-overlap, gt_index, track_index))
    used_gt, used_tracks, matches = set(), set(), []
    for neg_iou, gt_index, track_index in sorted(candidates):
        if gt_index in used_gt or track_index in used_tracks:
            continue
        used_gt.add(gt_index)
        used_tracks.add(track_index)
        matches.append((gt[gt_index][0], tracks[track_index].track_id, -neg_iou))
    return matches


def audit(frames, *, assignment='greedy', max_missed=30, identities=None):
    tracker = CentroidTracker(max_missed=max_missed, assignment=assignment)
    selected = None if identities is None else frozenset(int(value) for value in identities)
    previous = {}
    events = []
    matches_by_identity = defaultdict(int)

    for frame_index, gt in enumerate(frames, 1):
        # Identity-independent deterministic ordering prevents GT IDs leaking
        # through input order.
        detections = [box for _, box in sorted(
            gt, key=lambda item: (item[1].cx, item[1].cy, item[1].x1, item[1].y1)
        )]
        tracks = tracker.update(detections)
        for gt_id, track_id, overlap in _match(gt, tracks):
            if selected is not None and gt_id not in selected:
                continue
            matches_by_identity[gt_id] += 1
            old = previous.get(gt_id)
            if old is not None and old != track_id:
                events.append({
                    'frame': frame_index,
                    'gt_id': gt_id,
                    'tracker_id_before': old,
                    'tracker_id_after': track_id,
                    'iou': round(overlap, 6),
                })
            previous[gt_id] = track_id

    return {
        'assignment': assignment,
        'frames': len(frames),
        'identities': sorted(matches_by_identity),
        'matches_by_identity': {str(k): v for k, v in sorted(matches_by_identity.items())},
        'id_switches': len(events),
        'events': events,
        'accuracy_status': 'oracle_association_diagnostic_not_trackeval',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gt', required=True)
    parser.add_argument('--assignment', choices=('greedy', 'global'), default='greedy')
    parser.add_argument('--identity', type=int, action='append')
    parser.add_argument('--output')
    args = parser.parse_args()
    result = audit(load_mot_gt(args.gt), assignment=args.assignment,
                   identities=args.identity)
    text = json.dumps(result, indent=2) + '\n'
    if args.output:
        Path(args.output).write_text(text, encoding='utf-8')
    print(text, end='')


if __name__ == '__main__':
    main()

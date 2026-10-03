"""Measure detector boxes that overlap multiple GT identities in one frame.

This is a diagnostic for fused/ambiguous detections. It does not alter tracker
outputs and is not an accuracy metric by itself.
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

from sevenmetros_ai.tracking import Detection, bbox_iou


def load_gt(path):
    frames = defaultdict(dict)
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        row = line.split(',')
        frame, identity = int(row[0]), int(row[1])
        x, y, w, h = map(float, row[2:6])
        frames[frame][identity] = Detection(x, y, x+w, y+h)
    return frames


def audit(cache, gt, *, source_start, identities, overlap=.20, min_conf=.25):
    identities = tuple(int(value) for value in identities)
    if len(identities) < 2:
        raise ValueError('At least two identities are required')
    if not 0 < overlap <= 1 or not 0 <= min_conf <= 1:
        raise ValueError('Invalid thresholds')
    lines = Path(cache).read_text(encoding='utf-8').splitlines()
    events, both_visible = [], 0
    for task_frame in sorted(gt):
        boxes = gt[task_frame]
        if any(identity not in boxes for identity in identities):
            continue
        both_visible += 1
        source_frame = source_start + task_frame - 1
        if source_frame < 0 or source_frame >= len(lines):
            raise ValueError('GT range falls outside detection cache')
        detections = [Detection(**item) for item in json.loads(lines[source_frame])
                      if float(item.get('confidence', 1)) >= min_conf]
        for index, detection in enumerate(detections):
            overlaps = {identity: bbox_iou(detection, boxes[identity])
                        for identity in identities}
            if all(value >= overlap for value in overlaps.values()):
                events.append({
                    'task_frame': task_frame,
                    'source_frame': source_frame,
                    'detection_index': index,
                    'confidence': detection.confidence,
                    'overlaps': {str(k): round(v, 6) for k, v in overlaps.items()},
                })
    ambiguous_frames = sorted({event['task_frame'] for event in events})
    return {
        'identities': list(identities),
        'overlap_threshold': overlap,
        'min_confidence': min_conf,
        'frames_with_all_identities_visible': both_visible,
        'ambiguous_frame_count': len(ambiguous_frames),
        'ambiguous_frames': ambiguous_frames,
        'ambiguous_detection_count': len(events),
        'events': events,
        'status': 'DETECTION_AMBIGUITY_DIAGNOSTIC',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', required=True)
    parser.add_argument('--gt', required=True)
    parser.add_argument('--source-start', type=int, required=True)
    parser.add_argument('--identity', type=int, action='append', required=True)
    parser.add_argument('--overlap', type=float, default=.20)
    parser.add_argument('--min-confidence', type=float, default=.25)
    parser.add_argument('--output')
    args = parser.parse_args()
    result = audit(args.cache, load_gt(args.gt), source_start=args.source_start,
                   identities=args.identity, overlap=args.overlap,
                   min_conf=args.min_confidence)
    text = json.dumps(result, indent=2) + '\n'
    if args.output:
        Path(args.output).write_text(text, encoding='utf-8')
    print(text, end='')


if __name__ == '__main__':
    main()

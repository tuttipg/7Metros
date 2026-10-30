"""Measure GT box availability in a persisted detector cache before tracking.

Diagnostic only: this measures whether a detector box exists for a human GT box
at one or more confidence thresholds. It does not infer identity from detections
and it does not replace TrackEval.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


def box_iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def _load_review(path, qc_corrections=()):
    payload = json.loads(Path(path).read_text(encoding='utf-8'))
    boxes = payload.get('boxes')
    source = payload.get('manifest', {}).get('source_fixture_frames')
    if not isinstance(boxes, list) or not isinstance(source, list) or len(source) != 2:
        raise ValueError('review must contain boxes and manifest.source_fixture_frames')
    start, end = map(int, source)
    if end - start + 1 != len(boxes):
        raise ValueError('review frame count does not match source fixture range')
    frames = [[dict(row) for row in frame] for frame in boxes]
    applied = set()
    for task_frame, old_id, new_id in qc_corrections:
        if not 1 <= task_frame <= len(frames):
            raise ValueError('QC task frame out of range')
        matches = [row for row in frames[task_frame - 1] if int(row['id']) == old_id]
        if len(matches) != 1:
            raise ValueError('QC correction must match exactly one box')
        matches[0]['id'] = new_id
        applied.add((task_frame, old_id, new_id))
    return frames, start, end, applied


def _load_cache(path):
    rows = []
    with Path(path).open(encoding='utf-8') as stream:
        for line_number, line in enumerate(stream, 1):
            frame = json.loads(line)
            if not isinstance(frame, list):
                raise ValueError(f'cache line {line_number} is not a list')
            rows.append(frame)
    return rows


def audit(review, cache, *, ids, thresholds=(.25,), iou_threshold=.5,
          cache_meta=None, qc_corrections=(), top_y_boundary=5.0):
    if not ids or len(set(ids)) != len(ids) or any(int(identity) <= 0 for identity in ids):
        raise ValueError('ids must be unique positive integers')
    if not 0 < iou_threshold <= 1 or not math.isfinite(iou_threshold):
        raise ValueError('iou_threshold must be finite and in (0,1]')
    if not math.isfinite(top_y_boundary) or top_y_boundary <= 0:
        raise ValueError('top_y_boundary must be positive and finite')
    thresholds = tuple(sorted(set(float(value) for value in thresholds)))
    if not thresholds or any(
        not math.isfinite(value) or not 0 <= value <= 1 for value in thresholds
    ):
        raise ValueError('thresholds must be finite values in [0,1]')
    if cache_meta:
        meta = json.loads(Path(cache_meta).read_text(encoding='utf-8'))
        floor = float(meta.get('confidence', 1))
        if min(thresholds) + 1e-12 < floor:
            raise ValueError(
                f'cache floor {floor} cannot evaluate threshold {min(thresholds)}'
            )

    frames, start, end, applied_qc = _load_review(review, qc_corrections)
    detections = _load_cache(cache)
    if end >= len(detections):
        raise ValueError('cache does not contain requested fixture frames')

    result = {
        'status': 'DETECTOR_CACHE_RECALL_DIAGNOSTIC_NOT_TRACKEVAL',
        'source_fixture_frames': [start, end],
        'frames': len(frames),
        'iou_threshold': iou_threshold,
        'top_y_boundary': top_y_boundary,
        'thresholds': list(thresholds),
        'ids': {},
        'qc_corrections_applied': [list(row) for row in sorted(applied_qc)],
    }
    for identity in ids:
        present = 0
        matched = {threshold: 0 for threshold in thresholds}
        miss_frames = {threshold: [] for threshold in thresholds}
        spatial = {
            name: {
                'present_frames': 0,
                'matched': {threshold: 0 for threshold in thresholds},
            }
            for name in ('top_eq_0', 'top_lt_boundary', 'top_gte_boundary')
        }
        for offset, gt_rows in enumerate(frames):
            rows = [row for row in gt_rows if int(row['id']) == identity]
            if len(rows) > 1:
                raise ValueError(f'GT ID {identity} repeated in task frame {offset + 1}')
            if not rows:
                continue
            present += 1
            gt = rows[0]
            top_y = float(gt['y'])
            groups = [
                'top_lt_boundary' if top_y < top_y_boundary
                else 'top_gte_boundary'
            ]
            if math.isclose(top_y, 0.0, abs_tol=1e-9):
                groups.append('top_eq_0')
            for group in groups:
                spatial[group]['present_frames'] += 1
            gt_box = (
                float(gt['x']), float(gt['y']),
                float(gt['x']) + float(gt['w']),
                float(gt['y']) + float(gt['h']),
            )
            source_frame = start + offset
            raw = detections[source_frame]
            for threshold in thresholds:
                best = 0.0
                for detection in raw:
                    if float(detection.get('confidence', 0)) < threshold:
                        continue
                    box = tuple(
                        float(detection[key]) for key in ('x1', 'y1', 'x2', 'y2')
                    )
                    best = max(best, box_iou(gt_box, box))
                if best >= iou_threshold:
                    matched[threshold] += 1
                    for group in groups:
                        spatial[group]['matched'][threshold] += 1
                else:
                    miss_frames[threshold].append(source_frame)
        result['ids'][str(identity)] = {
            'present_frames': present,
            'by_confidence': {
                str(threshold): {
                    'matched_frames': matched[threshold],
                    'missed_frames': present - matched[threshold],
                    'recall_percent': round(
                        100 * matched[threshold] / present, 6
                    ) if present else 0.0,
                    'source_miss_frames': miss_frames[threshold],
                }
                for threshold in thresholds
            },
            'spatial_by_top_y': {
                name: {
                    'present_frames': values['present_frames'],
                    'by_confidence': {
                        str(threshold): {
                            'matched_frames': values['matched'][threshold],
                            'missed_frames': (
                                values['present_frames'] - values['matched'][threshold]
                            ),
                            'recall_percent': round(
                                100 * values['matched'][threshold] /
                                values['present_frames'], 6,
                            ) if values['present_frames'] else 0.0,
                        }
                        for threshold in thresholds
                    },
                }
                for name, values in spatial.items()
            },
        }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--review', required=True)
    parser.add_argument('--cache', required=True)
    parser.add_argument('--cache-meta')
    parser.add_argument('--id', dest='ids', action='append', type=int, required=True)
    parser.add_argument('--confidence', dest='thresholds', action='append',
                        type=float, required=True)
    parser.add_argument('--iou-threshold', type=float, default=.5)
    parser.add_argument('--top-y-boundary', type=float, default=5.0)
    parser.add_argument('--qc', dest='qc_corrections', action='append', default=[],
                        help='task_frame:old_id:new_id')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    qc = []
    for value in args.qc_corrections:
        parts = value.split(':')
        if len(parts) != 3:
            parser.error('--qc must be task_frame:old_id:new_id')
        qc.append(tuple(map(int, parts)))
    result = audit(
        args.review, args.cache, ids=args.ids, thresholds=args.thresholds,
        iou_threshold=args.iou_threshold, cache_meta=args.cache_meta,
        qc_corrections=qc, top_y_boundary=args.top_y_boundary,
    )
    output = Path(args.output)
    if output.exists():
        raise ValueError(f'Output already exists: {output}')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()

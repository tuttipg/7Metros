"""Flag suspicious one-frame reciprocal identity swaps in reviewed MOT JSON.

This is a QC warning tool, not an autocorrector. It looks for pairs of IDs that
are present in frames t-1, t and t+1 and asks whether swapping only their frame-t
labels would reduce the combined center-motion cost by a configurable margin.
Human review remains authoritative.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


def _center(item):
    try:
        x, y, w, h = (float(item[key]) for key in ('x', 'y', 'w', 'h'))
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError('box contains invalid geometry') from exc
    values = (x, y, w, h)
    if not all(math.isfinite(value) for value in values) or w <= 0 or h <= 0:
        raise ValueError('box contains invalid geometry')
    return x + w / 2.0, y + h / 2.0


def _distance(left, right):
    return math.hypot(left[0] - right[0], left[1] - right[1])


def _by_id(objects, frame):
    if not isinstance(objects, list):
        raise ValueError(f'frame {frame} boxes must be a list')
    result = {}
    for item in objects:
        identity = item.get('id')
        if not isinstance(identity, int) or isinstance(identity, bool) or identity <= 0:
            raise ValueError(f'frame {frame} has invalid identity')
        if identity in result:
            raise ValueError(f'frame {frame} repeats identity {identity}')
        result[identity] = _center(item)
    return result


def _path_cost(before, middle, after):
    return _distance(before, middle) + _distance(middle, after)


def audit(payload, *, minimum_improvement=20.0, maximum_swapped_cost=None):
    if minimum_improvement < 0 or not math.isfinite(minimum_improvement):
        raise ValueError('minimum_improvement must be finite and non-negative')
    if maximum_swapped_cost is not None and (
        maximum_swapped_cost <= 0 or not math.isfinite(maximum_swapped_cost)
    ):
        raise ValueError('maximum_swapped_cost must be finite and positive')
    boxes = payload.get('boxes')
    if not isinstance(boxes, list) or len(boxes) < 3:
        raise ValueError('review must contain at least three box frames')
    frames = [_by_id(objects, index) for index, objects in enumerate(boxes, 1)]
    warnings = []
    for index in range(1, len(frames) - 1):
        previous, current, following = frames[index - 1:index + 2]
        shared = sorted(set(previous) & set(current) & set(following))
        for offset, left_id in enumerate(shared):
            for right_id in shared[offset + 1:]:
                original = (
                    _path_cost(previous[left_id], current[left_id], following[left_id])
                    + _path_cost(previous[right_id], current[right_id], following[right_id])
                )
                swapped = (
                    _path_cost(previous[left_id], current[right_id], following[left_id])
                    + _path_cost(previous[right_id], current[left_id], following[right_id])
                )
                improvement = original - swapped
                if improvement < minimum_improvement:
                    continue
                if maximum_swapped_cost is not None and swapped > maximum_swapped_cost:
                    continue
                warnings.append({
                    'task_frame': index + 1,
                    'ids': [left_id, right_id],
                    'original_three_frame_motion_cost_px': round(original, 6),
                    'swapped_three_frame_motion_cost_px': round(swapped, 6),
                    'improvement_px': round(improvement, 6),
                    'action': 'HUMAN_REVIEW_REQUIRED_NO_AUTOCORRECTION',
                })
    warnings.sort(key=lambda row: (-row['improvement_px'], row['task_frame'], row['ids']))
    return {
        'status': 'QC_WARNINGS_ONLY',
        'frames': len(frames),
        'minimum_improvement_px': minimum_improvement,
        'maximum_swapped_cost_px': maximum_swapped_cost,
        'warning_count': len(warnings),
        'warnings': warnings,
        'note': 'Motion continuity is not identity proof. Never auto-correct from this audit.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--review-json', required=True)
    parser.add_argument('--minimum-improvement', type=float, default=20.0)
    parser.add_argument('--maximum-swapped-cost', type=float)
    parser.add_argument('--output')
    args = parser.parse_args()
    payload = json.loads(Path(args.review_json).read_text(encoding='utf-8'))
    result = audit(
        payload,
        minimum_improvement=args.minimum_improvement,
        maximum_swapped_cost=args.maximum_swapped_cost,
    )
    text = json.dumps(result, indent=2) + '\n'
    if args.output:
        output = Path(args.output)
        if output.exists():
            raise ValueError(f'Output already exists: {output}')
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(text, encoding='utf-8')
    print(text, end='')


if __name__ == '__main__':
    main()

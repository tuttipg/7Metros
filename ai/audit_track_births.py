"""Compare track births without treating reassociation as a lost observation.

This audit uses exact serialized observations shared by two tracker replays. It
does not decide whether either identity is correct and is not an accuracy metric.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path

from benchmark_detector_resolution import parse_range, validate_ranges


def observation_key(obj):
    return obj['kind'], obj['confidence'], tuple(obj['bbox_xyxy'])


def load_rows(path):
    rows = {}
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        row = json.loads(line)
        frame = row['frame_index']
        if frame in rows:
            raise ValueError(f'Duplicate frame {frame} in {path}')
        rows[frame] = row
    return rows


def index_tracks(rows, ranges):
    first = {}
    counts = Counter()
    for range_index, (start, end) in enumerate(ranges):
        for frame in range(start, end):
            for obj in rows[frame]['objects']:
                key = (range_index, obj['track_id'])
                first.setdefault(key, frame)
                counts[key] += 1
    return first, counts


def classify_births(source_rows, other_rows, ranges):
    source_first, source_counts = index_tracks(source_rows, ranges)
    other_first, other_counts = index_tracks(other_rows, ranges)
    events = []
    for range_index, (start, end) in enumerate(ranges):
        for frame in range(start, end):
            other_by_observation = {
                observation_key(obj): obj for obj in other_rows[frame]['objects']
            }
            for obj in source_rows[frame]['objects']:
                source_id = obj['track_id']
                source_track = (range_index, source_id)
                if source_first[source_track] != frame or frame == start:
                    continue
                match = other_by_observation.get(observation_key(obj))
                if match is None:
                    outcome = 'observation_replaced_or_missing'
                    other_id = None
                    other_track_observations = None
                else:
                    other_id = match['track_id']
                    other_track = (range_index, other_id)
                    outcome = (
                        'also_born' if other_first[other_track] == frame
                        else 'absorbed_by_existing_track'
                    )
                    other_track_observations = other_counts[other_track]
                events.append({
                    'range_end_exclusive': [start, end],
                    'frame_index': frame,
                    'source_track_id': source_id,
                    'source_track_observations': source_counts[source_track],
                    'other_track_id': other_id,
                    'other_track_observations': other_track_observations,
                    'outcome': outcome,
                    'observation': {
                        'kind': obj['kind'],
                        'confidence': obj['confidence'],
                        'bbox_xyxy': obj['bbox_xyxy'],
                    },
                })
    return events


def audit(baseline_path, candidate_path, ranges):
    ranges = validate_ranges(ranges)
    baseline = load_rows(baseline_path)
    candidate = load_rows(candidate_path)
    expected = {frame for start, end in ranges for frame in range(start, end)}
    for name, rows in (('baseline', baseline), ('candidate', candidate)):
        missing = sorted(expected - rows.keys())
        extra = sorted(rows.keys() - expected)
        if missing or extra:
            raise ValueError(
                f'{name} frame mismatch: missing={missing[:5]}, extra={extra[:5]}'
            )

    baseline_births = classify_births(baseline, candidate, ranges)
    candidate_births = classify_births(candidate, baseline, ranges)
    return {
        'scope': 'exact-observation birth audit; identity correctness not evaluated',
        'ranges_end_exclusive': ranges,
        'baseline_births_after_range_start': {
            'count': len(baseline_births),
            'outcomes': dict(sorted(Counter(
                event['outcome'] for event in baseline_births
            ).items())),
            'events': baseline_births,
        },
        'candidate_births_after_range_start': {
            'count': len(candidate_births),
            'outcomes': dict(sorted(Counter(
                event['outcome'] for event in candidate_births
            ).items())),
            'events': candidate_births,
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', required=True)
    parser.add_argument('--candidate', required=True)
    parser.add_argument('--range', dest='ranges', action='append', type=parse_range,
                        required=True)
    parser.add_argument('--output')
    args = parser.parse_args()
    result = audit(args.baseline, args.candidate, args.ranges)
    rendered = json.dumps(result, indent=2) + '\n'
    if args.output:
        Path(args.output).write_text(rendered, encoding='utf-8')
    print(rendered, end='')


if __name__ == '__main__':
    main()

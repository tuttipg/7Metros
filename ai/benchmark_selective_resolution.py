"""Replay 640/1280 caches to evaluate a selective-resolution trigger.

This command performs no neural inference.  Runtime is an explicit linear
estimate from previously measured inference runs, while sparse point coverage
is only a diagnostic and is not detection accuracy or ground truth.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

from diagnose_stages import point_status
from sevenmetros_ai.fixture_filter import suppress_duplicates
from sevenmetros_ai.selective_resolution import merged_box_frames, select_resolution
from sevenmetros_ai.tracking import Detection


def sha256_file(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def load_cache(path):
    result = {}
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        record = json.loads(line)
        frame = int(record['frame_index'])
        if frame in result:
            raise ValueError(f'Duplicate frame {frame} in {path}')
        result[frame] = [Detection(**item) for item in record['objects']]
    if not result:
        raise ValueError(f'Empty detection cache: {path}')
    return result


def load_points(paths, frames):
    points = {}
    for path in paths:
        payload = json.loads(Path(path).read_text(encoding='utf-8'))
        for point in payload['points']:
            frame = int(point['frame'])
            if frame in frames:
                points.setdefault(frame, []).append(point)
    if not points:
        raise ValueError('No sparse reference points overlap cache frames')
    return points


def point_summary(detections_by_frame, points):
    counts = Counter()
    for frame, frame_points in points.items():
        counts.update(
            item['status'] for item in point_status(
                detections_by_frame[frame], frame_points,
            )
        )
    return {
        key: counts.get(key, 0)
        for key in ('unique_box', 'shared_box', 'ambiguous', 'missing')
    }


def validate_prior_run(prior, baseline_hash, candidate_hash, frames):
    configurations = prior.get('configurations', {})
    for label, digest in (
        ('baseline', baseline_hash), ('candidate', candidate_hash),
    ):
        configuration = configurations.get(label, {})
        if configuration.get('detections_sha256') != digest:
            raise ValueError(f'{label} cache hash does not match comparison metadata')
        if configuration.get('frames') != frames:
            raise ValueError(f'{label} frame count does not match comparison metadata')


def benchmark(baseline_cache, candidate_cache, comparison, references, output):
    baseline = load_cache(baseline_cache)
    candidate = load_cache(candidate_cache)
    baseline_hash = sha256_file(baseline_cache)
    candidate_hash = sha256_file(candidate_cache)
    if set(baseline) != set(candidate):
        raise ValueError('Baseline and candidate caches must contain identical frames')
    prior = json.loads(Path(comparison).read_text(encoding='utf-8'))
    validate_prior_run(prior, baseline_hash, candidate_hash, len(baseline))
    selected = merged_box_frames(baseline)
    hybrid = select_resolution(baseline, candidate, selected)
    points = load_points(references, set(baseline))

    baseline_seconds = prior['configurations']['baseline'][
        'wall_seconds_decode_and_inference'
    ]
    candidate_seconds = prior['configurations']['candidate'][
        'wall_seconds_decode_and_inference'
    ]
    frames = len(baseline)
    selected_count = len(selected)
    estimated_seconds = baseline_seconds + candidate_seconds * selected_count / frames

    configurations = {}
    for name, detections in (
        ('baseline_640', baseline),
        ('candidate_1280', candidate),
        ('selective_640_1280', hybrid),
    ):
        deduplicated = {
            frame: suppress_duplicates(items)
            for frame, items in detections.items()
        }
        configurations[name] = {
            'raw_detections': sum(map(len, detections.values())),
            'deduplicated_detections': sum(map(len, deduplicated.values())),
            'raw_sparse_point_status': point_summary(detections, points),
            'deduplicated_sparse_point_status': point_summary(deduplicated, points),
        }

    result = {
        'scope': 'replay_of_existing_640_and_1280_neural_inference_caches',
        'trigger': {
            'independent_of_sparse_points': True,
            'threshold_selection': 'exploratory on these same two ranges; not held out',
            'coverage': .50,
            'maximum_neighbor_pair_iou': .20,
            'minimum_current_box_aspect': .35,
            'uses_adjacent_frames': True,
            'selected_frames': sorted(selected),
            'selected_count': selected_count,
            'selected_fraction': selected_count / frames,
        },
        'inputs': {
            'baseline_cache_sha256': baseline_hash,
            'candidate_cache_sha256': candidate_hash,
            'comparison_sha256': sha256_file(comparison),
            'frames': frames,
        },
        'configurations': configurations,
        'runtime_estimate': {
            'method': 'measured 640 full run plus proportional 1280 measured full run',
            'not_measured_end_to_end': True,
            'baseline_640_seconds_measured': baseline_seconds,
            'candidate_1280_seconds_measured': candidate_seconds,
            'selective_seconds_estimated': estimated_seconds,
            'selective_fps_estimated': frames / estimated_seconds,
            'estimated_time_reduction_vs_full_1280': 1 - estimated_seconds / candidate_seconds,
        },
        'standard_detection_metrics': None,
        'standard_tracking_metrics': None,
        'limitation': (
            'Sparse assistant-selected points are not independently reviewed ground truth; '
            'trigger thresholds were explored on these ranges, and the runtime estimate '
            'requires measured full-sequence validation.'
        ),
    }
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline-cache', required=True)
    parser.add_argument('--candidate-cache', required=True)
    parser.add_argument('--comparison', required=True)
    parser.add_argument('--reference', dest='references', action='append', required=True)
    parser.add_argument('--output', required=True)
    print(json.dumps(benchmark(**vars(parser.parse_args())), indent=2))


if __name__ == '__main__':
    main()

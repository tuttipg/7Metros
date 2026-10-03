"""Benchmark YOLO input sizes on exact source frames and sparse contact points.

Every configuration performs new neural inference.  Sparse point coverage is a
diagnostic for merged/duplicate boxes, not detection accuracy or ground truth.
"""
from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import asdict
import hashlib
import json
import math
from pathlib import Path
import time

from diagnose_stages import point_status
from sevenmetros_ai.detectors import UltralyticsPersonDetector
from sevenmetros_ai.fixture_filter import suppress_duplicates


def parse_range(value):
    try:
        start, end = (int(part) for part in value.split(':', 1))
    except (TypeError, ValueError) as exc:
        raise argparse.ArgumentTypeError('Use START:END frame ranges') from exc
    if start < 0 or end <= start:
        raise argparse.ArgumentTypeError('Frame range must satisfy 0 <= START < END')
    return start, end


def validate_ranges(ranges):
    if not ranges:
        raise ValueError('At least one frame range is required')
    ordered = sorted(ranges)
    for previous, current in zip(ordered, ordered[1:]):
        if current[0] < previous[1]:
            raise ValueError('Frame ranges must not overlap')
    return ordered


def load_references(paths, video_sha, width, height, selected_frames):
    points = {}
    sources = []
    for path in paths:
        payload = json.loads(Path(path).read_text(encoding='utf-8'))
        if payload.get('video_sha256') != video_sha:
            raise ValueError(f'Reference video hash mismatch: {path}')
        if (payload.get('width'), payload.get('height')) != (width, height):
            raise ValueError(f'Reference dimensions mismatch: {path}')
        for point in payload['points']:
            frame = int(point['frame'])
            if frame not in selected_frames:
                raise ValueError(f'Reference frame {frame} is outside selected ranges')
            points.setdefault(frame, []).append(point)
        sources.append({'path': Path(path).name, 'scope': payload.get('scope')})
    return points, sources


def summarize_points(detections_by_frame, reference_points):
    counts = Counter()
    per_frame = {}
    for frame in sorted(reference_points):
        statuses = point_status(detections_by_frame[frame], reference_points[frame])
        counts.update(item['status'] for item in statuses)
        per_frame[str(frame)] = statuses
    for key in ('unique_box', 'shared_box', 'ambiguous', 'missing'):
        counts.setdefault(key, 0)
    return {'counts': dict(counts), 'frames': per_frame}


def run_size(video, model, confidence, image_size, ranges, reference_points):
    import cv2

    detector = UltralyticsPersonDetector(
        str(model), confidence=confidence, device='cpu', image_size=image_size,
    )
    capture = cv2.VideoCapture(str(video))
    if not capture.isOpened():
        raise ValueError('Could not open video')
    detections_by_frame = {}
    records = []
    raw_total = deduplicated_total = high_total = 0
    # Exclude model loading and one warm-up inference from the timed region.
    capture.set(cv2.CAP_PROP_POS_FRAMES, ranges[0][0])
    ok, warmup = capture.read()
    if not ok:
        raise ValueError('Could not read warm-up frame')
    detector.detect(warmup)
    started = time.perf_counter()
    try:
        for start, end in ranges:
            capture.set(cv2.CAP_PROP_POS_FRAMES, start)
            for frame_index in range(start, end):
                ok, frame = capture.read()
                if not ok:
                    raise ValueError(f'Video truncated at frame {frame_index}')
                detections = detector.detect(frame)
                deduplicated = suppress_duplicates(detections)
                raw_total += len(detections)
                deduplicated_total += len(deduplicated)
                high_total += sum(item.confidence >= .25 for item in detections)
                if frame_index in reference_points:
                    detections_by_frame[frame_index] = detections
                records.append({
                    'frame_index': frame_index,
                    'objects': [asdict(item) for item in detections],
                })
    finally:
        capture.release()
    seconds = time.perf_counter() - started
    frames = len(records)
    if set(detections_by_frame) != set(reference_points):
        raise ValueError('Not all reference frames were inferred')
    deduplicated_by_frame = {
        frame: suppress_duplicates(detections)
        for frame, detections in detections_by_frame.items()
    }
    return records, {
        'image_size': image_size,
        'frames': frames,
        'wall_seconds_decode_and_inference': seconds,
        'frames_per_second': frames / seconds,
        'raw_detections_confidence_010': raw_total,
        'raw_detections_confidence_025_or_higher': high_total,
        'after_duplicate_rule_iou_055': deduplicated_total,
        'duplicate_rule_removals': raw_total - deduplicated_total,
        'raw_reference_points': summarize_points(detections_by_frame, reference_points),
        'deduplicated_reference_points': summarize_points(
            deduplicated_by_frame, reference_points,
        ),
    }


def sha256_file(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def benchmark(video, model, output, ranges, references, confidence=.10,
              baseline_size=640, candidate_size=1280):
    if not math.isfinite(confidence) or not 0 <= confidence <= 1:
        raise ValueError('confidence must be finite and in [0,1]')
    for size in (baseline_size, candidate_size):
        if not isinstance(size, int) or size <= 0:
            raise ValueError('Image sizes must be positive integers')
    if baseline_size == candidate_size:
        raise ValueError('Baseline and candidate image sizes must differ')
    if not references:
        raise ValueError('At least one sparse reference is required')
    ranges = validate_ranges(ranges)
    video, model = Path(video), Path(model)
    output = Path(output)
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        raise ValueError(f'Output path must be an empty directory: {output}')

    import cv2
    capture = cv2.VideoCapture(str(video))
    try:
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        video_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if not capture.isOpened() or width <= 0 or height <= 0 or video_frames <= 0:
            raise ValueError('Invalid video metadata')
    finally:
        capture.release()
    if any(end > video_frames for _, end in ranges):
        raise ValueError('Selected range exceeds video length')
    video_sha = sha256_file(video)
    selected = {frame for start, end in ranges for frame in range(start, end)}
    reference_points, reference_sources = load_references(
        references, video_sha, width, height, selected,
    )

    import torch
    torch.set_num_threads(2)
    output.mkdir(parents=True, exist_ok=True)
    configurations = {}
    for label, size in [('baseline', baseline_size), ('candidate', candidate_size)]:
        records, summary = run_size(
            video, model, confidence, size, ranges, reference_points,
        )
        path = output / f'{label}_{size}.jsonl'
        with path.open('w', encoding='utf-8') as stream:
            for record in records:
                stream.write(json.dumps(record) + '\n')
        summary['detections_sha256'] = sha256_file(path)
        configurations[label] = summary
    result = {
        'scope': 'new neural inference for both configurations on exact source frames',
        'limitation': (
            'Sparse assistant-selected torso points diagnose merged/duplicate boxes; '
            'they are not complete or independently reviewed ground truth.'
        ),
        'video': video.name,
        'video_sha256': video_sha,
        'model': model.name,
        'model_sha256': sha256_file(model),
        'confidence': confidence,
        'ranges_end_exclusive': ranges,
        'reference_sources': reference_sources,
        'configurations': configurations,
        'standard_detection_metrics': None,
        'standard_tracking_metrics': None,
    }
    (output / 'comparison.json').write_text(
        json.dumps(result, indent=2) + '\n', encoding='utf-8',
    )
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', required=True)
    parser.add_argument('--model', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--range', dest='ranges', action='append', type=parse_range, required=True)
    parser.add_argument('--reference', dest='references', action='append', required=True)
    parser.add_argument('--confidence', type=float, default=.10)
    parser.add_argument('--baseline-size', type=int, default=640)
    parser.add_argument('--candidate-size', type=int, default=1280)
    print(json.dumps(benchmark(**vars(parser.parse_args())), indent=2))


if __name__ == '__main__':
    main()

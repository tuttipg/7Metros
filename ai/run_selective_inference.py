"""Execute selective 640/1280 inference and tracker-health replay.

Unlike ``benchmark_selective_resolution.py``, this command performs fresh neural
inference.  It first detects every selected source frame at 640, derives an
annotation-independent track-contact trigger, then runs 1280 inference only on
triggered frames and replaces boxes only inside the contact region. Sparse
points and tracker-health summaries are diagnostics, not ground-truth accuracy.
"""
from __future__ import annotations

import argparse
from dataclasses import asdict
import json
from pathlib import Path
import time

from audit_points import audit
from benchmark_detector_resolution import (
    load_references,
    parse_range,
    sha256_file,
    summarize_points,
    validate_ranges,
)
from sevenmetros_ai.detectors import UltralyticsPersonDetector
from sevenmetros_ai.fixture_filter import suppress_duplicates
from sevenmetros_ai.fixture_kits import FerroLujanKits
from sevenmetros_ai.metrics import TrackingMetrics
from sevenmetros_ai.schema import frame_payload
from sevenmetros_ai.selective_resolution import (
    contact_regions,
    fuse_resolution_regions_with_spawn_mask,
)
from sevenmetros_ai.tracking import CentroidTracker


def infer_pass(capture, detector, ranges, selected_frames=None):
    import cv2

    detections = {}
    inference_seconds = 0.0
    started = time.perf_counter()
    for start, end in ranges:
        capture.set(cv2.CAP_PROP_POS_FRAMES, start)
        for frame_index in range(start, end):
            ok, frame = capture.read()
            if not ok:
                raise ValueError(f'Video truncated at frame {frame_index}')
            if selected_frames is not None and frame_index not in selected_frames:
                continue
            inference_started = time.perf_counter()
            detections[frame_index] = detector.detect(frame)
            inference_seconds += time.perf_counter() - inference_started
    return detections, {
        'pass_wall_seconds': time.perf_counter() - started,
        'neural_inference_seconds': inference_seconds,
    }


def write_cache(path, detections_by_frame):
    with Path(path).open('w', encoding='utf-8') as stream:
        for frame, detections in sorted(detections_by_frame.items()):
            stream.write(json.dumps({
                'frame_index': frame,
                'objects': [asdict(detection) for detection in detections],
            }) + '\n')


def summarize_optional_points(detections_by_frame, reference_points):
    """Return point counts only when an explicit diagnostic set was supplied."""
    if not reference_points:
        return None
    return summarize_points(detections_by_frame, reference_points)['counts']


def find_contact_regions(video, ranges, detections_by_frame):
    """Replay fixture filtering/tracking to locate boxes hiding two live tracks."""
    import cv2

    capture = cv2.VideoCapture(str(video))
    classifier = FerroLujanKits()
    result = {}
    started = time.perf_counter()
    try:
        for start, end in ranges:
            tracker = CentroidTracker(
                max_missed=30, temporal_teams=True, two_stage=True,
            )
            capture.set(cv2.CAP_PROP_POS_FRAMES, start)
            for frame_index in range(start, end):
                ok, frame = capture.read()
                if not ok:
                    raise ValueError(f'Video truncated at frame {frame_index}')
                filtered = classifier.classify(frame, detections_by_frame[frame_index])
                regions = contact_regions(filtered, tracker.active_tracks)
                if regions:
                    result[frame_index] = regions
                tracker.update(filtered)
    finally:
        capture.release()
    return result, time.perf_counter() - started


def detection_key(detection):
    return (
        detection.x1, detection.y1, detection.x2, detection.y2,
        detection.confidence, detection.label,
    )


def replay_two_stage(video, ranges, detections_by_frame, output, references, fps,
                     width, height, spawnable_by_frame=None):
    import cv2

    capture = cv2.VideoCapture(str(video))
    classifier = FerroLujanKits()
    rows = {}
    range_summaries = []
    stream = Path(output).open('w', encoding='utf-8')
    try:
        for start, end in ranges:
            tracker = CentroidTracker(
                max_missed=30, temporal_teams=True, two_stage=True,
            )
            metrics = TrackingMetrics()
            weak_observations = 0
            capture.set(cv2.CAP_PROP_POS_FRAMES, start)
            for source_frame in range(start, end):
                ok, frame = capture.read()
                if not ok:
                    raise ValueError(f'Video truncated at frame {source_frame}')
                filtered = classifier.classify(frame, detections_by_frame[source_frame])
                spawnable = None
                if spawnable_by_frame is not None:
                    raw = detections_by_frame[source_frame]
                    raw_spawnable = spawnable_by_frame[source_frame]
                    non_spawnable = {
                        detection_key(detection)
                        for detection, allowed in zip(raw, raw_spawnable)
                        if not allowed
                    }
                    spawnable = [
                        detection_key(detection) not in non_spawnable
                        for detection in filtered
                    ]
                tracks = tracker.update(filtered, spawnable=spawnable)
                metrics.observe(source_frame - start, tracks)
                weak_observations += sum(
                    track.detection.confidence < .25 for track in tracks
                )
                row = frame_payload(
                    frame_index=source_frame,
                    timestamp_ms=source_frame * 1000.0 / fps,
                    width=width,
                    height=height,
                    tracks=tracks,
                )
                rows[source_frame] = row
                stream.write(json.dumps(row) + '\n')
            summary = metrics.summary()
            summary['mean_continuous_run_seconds'] = (
                summary['mean_continuous_run_frames'] / fps
            )
            summary['weak_track_observations'] = weak_observations
            range_summaries.append({
                'range_end_exclusive': [start, end],
                'metrics': summary,
            })
    finally:
        stream.close()
        capture.release()

    sparse_audits = {}
    for path in references:
        reference = json.loads(Path(path).read_text(encoding='utf-8'))
        sparse_audits[Path(path).name] = audit(reference, rows)
    return {
        'scope': 'two-stage tracker replay after fresh inference; identity not verified',
        'ranges': range_summaries,
        'sparse_audits': sparse_audits,
    }


def run(video, model, output, ranges, references=None, confidence=.10,
        baseline_size=640, candidate_size=1280):
    import cv2
    import torch

    ranges = validate_ranges(ranges)
    selected_source_frames = {
        frame for start, end in ranges for frame in range(start, end)
    }
    video, model, output = Path(video), Path(model), Path(output)
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        raise ValueError(f'Output path must be an empty directory: {output}')

    capture = cv2.VideoCapture(str(video))
    try:
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if not capture.isOpened() or width <= 0 or height <= 0 or fps <= 0:
            raise ValueError('Invalid video metadata')
        if any(end > frame_count for _, end in ranges):
            raise ValueError('Selected range exceeds video length')

        video_sha = sha256_file(video)
        references = references or []
        if references:
            reference_points, reference_sources = load_references(
                references, video_sha, width, height, selected_source_frames,
            )
        else:
            reference_points, reference_sources = {}, []
        torch.set_num_threads(2)
        baseline_detector = UltralyticsPersonDetector(
            str(model), confidence=confidence, device='cpu', image_size=baseline_size,
        )
        candidate_detector = UltralyticsPersonDetector(
            str(model), confidence=confidence, device='cpu', image_size=candidate_size,
        )

        capture.set(cv2.CAP_PROP_POS_FRAMES, ranges[0][0])
        ok, warmup = capture.read()
        if not ok:
            raise ValueError('Could not read warm-up frame')
        baseline_detector.detect(warmup)
        candidate_detector.detect(warmup)

        total_started = time.perf_counter()
        baseline, baseline_timing = infer_pass(capture, baseline_detector, ranges)
        regions, trigger_seconds = find_contact_regions(video, ranges, baseline)
        triggered = set(regions)
        candidate_selected, candidate_timing = infer_pass(
            capture, candidate_detector, ranges, triggered,
        )
        hybrid = {}
        hybrid_spawnable = {}
        for frame, detections in baseline.items():
            fused, spawnable = fuse_resolution_regions_with_spawn_mask(
                detections,
                candidate_selected.get(frame, []),
                regions.get(frame, []),
            )
            hybrid[frame] = fused
            hybrid_spawnable[frame] = spawnable
        total_seconds = time.perf_counter() - total_started
    finally:
        capture.release()

    output.mkdir(parents=True, exist_ok=True)
    cache_paths = {
        'baseline_640': output / 'baseline_640.jsonl',
        'candidate_1280_selected': output / 'candidate_1280_selected.jsonl',
        'selective_640_1280': output / 'selective_640_1280.jsonl',
    }
    write_cache(cache_paths['baseline_640'], baseline)
    write_cache(cache_paths['candidate_1280_selected'], candidate_selected)
    write_cache(cache_paths['selective_640_1280'], hybrid)

    configurations = {}
    for name, detections in (('baseline_640', baseline), ('selective_640_1280', hybrid)):
        deduplicated = {
            frame: suppress_duplicates(items) for frame, items in detections.items()
        }
        configurations[name] = {
            'raw_detections': sum(map(len, detections.values())),
            'deduplicated_detections': sum(map(len, deduplicated.values())),
            'raw_sparse_point_status': summarize_optional_points(
                detections, reference_points,
            ),
            'deduplicated_sparse_point_status': summarize_optional_points(
                deduplicated, reference_points,
            ),
            'cache_sha256': sha256_file(cache_paths[name]),
            'tracking_health': replay_two_stage(
                video, ranges, detections,
                output / f'{name}_two_stage_tracks.jsonl',
                references, fps, width, height,
                hybrid_spawnable if name == 'selective_640_1280' else None,
            ),
        }
        if name == 'selective_640_1280':
            configurations[name]['selective_replacements_may_spawn_tracks'] = False

    result = {
        'scope': 'fresh neural inference: full 640 pass plus triggered 1280 pass',
        'execution_strategy': 'offline_640_then_track_contact_trigger_then_local_1280_fusion',
        'accuracy_status': 'not_evaluated_no_independently_reviewed_ground_truth',
        'video': video.name,
        'video_sha256': video_sha,
        'model': model.name,
        'model_sha256': sha256_file(model),
        'confidence': confidence,
        'ranges_end_exclusive': ranges,
        'frames': len(baseline),
        'reference_sources': reference_sources,
        'reference_status': (
            'diagnostic_points_supplied' if reference_sources
            else 'no_points_supplied_unbiased_tracker_health_only'
        ),
        'trigger': {
            'criterion': (
                'one 640 box contains two predicted track centers separated by at least '
                '20% of its diagonal; tracks may be missed for at most 6 frames'
            ),
            'selected_frames': sorted(triggered),
            'selected_count': len(triggered),
            'selected_fraction': len(triggered) / len(baseline),
            'seconds_measured': trigger_seconds,
        },
        'runtime_measured_excluding_model_load_and_warmup': {
            'total_seconds': total_seconds,
            'effective_fps': len(baseline) / total_seconds,
            'baseline_pass': baseline_timing,
            'candidate_selected_pass': candidate_timing,
        },
        'configurations': configurations,
        'selected_candidate_cache_sha256': sha256_file(
            cache_paths['candidate_1280_selected'],
        ),
        'standard_detection_metrics': None,
        'standard_tracking_metrics': None,
        'limitation': (
            'Tracker-health metrics are not independently reviewed ground truth. '
            + (
                'Sparse supplied points are diagnostics only.'
                if reference_sources else
                'No point-level accuracy diagnostic was run.'
            )
        ),
    }
    comparison = output / 'comparison.json'
    comparison.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', required=True)
    parser.add_argument('--model', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--range', dest='ranges', action='append', type=parse_range, required=True)
    parser.add_argument('--reference', dest='references', action='append')
    parser.add_argument('--confidence', type=float, default=.10)
    parser.add_argument('--baseline-size', type=int, default=640)
    parser.add_argument('--candidate-size', type=int, default=1280)
    print(json.dumps(run(**vars(parser.parse_args())), indent=2))


if __name__ == '__main__':
    main()

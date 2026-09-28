"""Compare three trackers on one verified low-confidence detection cache.

This performs cache replay, not neural inference.  Every tracker receives boxes
from the same video/cache and fixture filter.  The high-only baseline receives
only detections with confidence >= 0.25; the two-stage baseline and standard
Ultralytics ByteTrack receive the complete >= 0.10 stream.
"""
from __future__ import annotations

import argparse
from dataclasses import replace
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

from sevenmetros_ai.fixture_kits import FerroLujanKits
from sevenmetros_ai.metrics import TrackingMetrics
from sevenmetros_ai.role_filter import TemporalRoleFilter
from sevenmetros_ai.schema import clipped_bbox, frame_payload
from sevenmetros_ai.tracking import CentroidTracker, Detection, Track


class DetectionResults:
    """Minimal Results-like array accepted by Ultralytics BYTETracker."""

    def __init__(self, detections):
        import numpy as np

        self._detections = list(detections)
        self.conf = np.asarray([d.confidence for d in self._detections], dtype=np.float32)
        self.cls = np.zeros(len(self._detections), dtype=np.float32)
        self.xywh = np.asarray(
            [[d.cx, d.cy, d.x2 - d.x1, d.y2 - d.y1] for d in self._detections],
            dtype=np.float32,
        ).reshape((-1, 4))

    def __len__(self):
        return len(self._detections)

    def __getitem__(self, selection):
        import numpy as np

        indexes = np.arange(len(self._detections))[selection]
        indexes = np.atleast_1d(indexes).tolist()
        return DetectionResults([self._detections[int(index)] for index in indexes])


class StandardByteTrack:
    """Thin adapter around the installed Ultralytics ByteTrack defaults."""

    def __init__(self, frame_rate=30):
        try:
            from ultralytics.trackers.byte_tracker import BYTETracker
        except ImportError as exc:
            raise RuntimeError(
                "Ultralytics ByteTrack requires the vision dependencies and lap>=0.5.12"
            ) from exc
        self.version = __import__('ultralytics').__version__
        self.config = {
            'track_high_thresh': .25,
            'track_low_thresh': .10,
            'new_track_thresh': .25,
            'track_buffer': 30,
            'match_thresh': .80,
            'fuse_score': True,
        }
        self._tracker = BYTETracker(SimpleNamespace(**self.config))
        self.frame_rate = frame_rate

    def update(self, detections):
        rows = self._tracker.update(DetectionResults(detections))
        tracks = []
        for row in rows:
            source_index = int(row[7])
            source = detections[source_index]
            observed = replace(
                source,
                x1=float(row[0]), y1=float(row[1]),
                x2=float(row[2]), y2=float(row[3]),
                confidence=float(row[5]),
            )
            tracks.append(Track(
                track_id=int(row[4]), detection=observed,
                observed_role_candidate=source.role_candidate,
            ))
        return tracks


def _validated_meta(video, cache):
    meta_path = cache.with_suffix('.meta.json')
    if not meta_path.is_file():
        raise ValueError(f'Missing cache metadata: {meta_path}')
    meta = json.loads(meta_path.read_text())
    with video.open('rb') as stream:
        video_sha256 = hashlib.file_digest(stream, 'sha256').hexdigest()
    if meta.get('video_sha256') != video_sha256:
        raise ValueError('Cache video hash mismatch')
    if float(meta.get('confidence', 1)) > .10:
        raise ValueError('Comparison requires a cache generated at confidence 0.10 or lower')
    return meta


def compare(video, cache, output_dir, max_frames=None, exclude_confirmed_referees=False):
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError('OpenCV is required for fixture-filter replay') from exc

    video, cache, output_dir = Path(video), Path(cache), Path(output_dir)
    meta = _validated_meta(video, cache)
    output_dir.mkdir(parents=True, exist_ok=True)
    capture = cv2.VideoCapture(str(video))
    if not capture.isOpened():
        raise RuntimeError(f'Could not open video: {video}')
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    expected_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if fps <= 0 or width <= 0 or height <= 0:
        capture.release()
        raise RuntimeError('Invalid video metadata')

    trackers = {
        'baseline_high_only': CentroidTracker(max_missed=30, temporal_teams=True),
        'two_stage': CentroidTracker(max_missed=30, temporal_teams=True, two_stage=True),
        'bytetrack_standard': StandardByteTrack(frame_rate=fps),
    }
    metrics = {name: TrackingMetrics() for name in trackers}
    streams = {
        name: (output_dir / f'{name}.jsonl').open('w', encoding='utf-8')
        for name in trackers
    }
    observations = {name: 0 for name in trackers}
    weak_observations = {name: 0 for name in trackers}
    clipped_output_boxes = {name: 0 for name in trackers}
    dropped_outside_boxes = {name: 0 for name in trackers}
    excluded_role_observations = {name: 0 for name in trackers}
    role_filters = {
        name: TemporalRoleFilter() for name in trackers
    } if exclude_confirmed_referees else {}
    classifier = FerroLujanKits(allow_boundary_roles=exclude_confirmed_referees)
    frames = raw_detections = filtered_detections = 0

    try:
        with cache.open(encoding='utf-8') as detection_stream:
            for line in detection_stream:
                if max_frames is not None and frames >= max_frames:
                    break
                ok, frame = capture.read()
                if not ok:
                    raise RuntimeError(f'Video ended before cache at frame {frames}')
                raw = [Detection(**item) for item in json.loads(line)]
                filtered = classifier.classify(frame, raw)
                raw_detections += len(raw)
                filtered_detections += len(filtered)
                inputs = {
                    'baseline_high_only': [d for d in filtered if d.confidence >= .25],
                    'two_stage': filtered,
                    'bytetrack_standard': filtered,
                }
                for name, tracker in trackers.items():
                    tracks = tracker.update(inputs[name])
                    if exclude_confirmed_referees:
                        tracks, excluded = role_filters[name].filter(tracks, frames)
                        excluded_role_observations[name] += excluded
                    for track in tracks:
                        clipped = clipped_bbox(track.detection, width, height)
                        if clipped is None:
                            dropped_outside_boxes[name] += 1
                        elif clipped != (
                            track.detection.x1, track.detection.y1,
                            track.detection.x2, track.detection.y2,
                        ):
                            clipped_output_boxes[name] += 1
                    metrics[name].observe(frames, tracks)
                    observations[name] += len(tracks)
                    weak_observations[name] += sum(
                        track.detection.confidence < .25 for track in tracks
                    )
                    streams[name].write(json.dumps(frame_payload(
                        frame_index=frames,
                        timestamp_ms=frames * 1000.0 / fps,
                        width=width,
                        height=height,
                        tracks=tracks,
                    )) + '\n')
                frames += 1
            if max_frames is None and expected_frames and frames != expected_frames:
                raise RuntimeError(
                    f'Cache/video frame mismatch: cache={frames}, video={expected_frames}'
                )
    finally:
        capture.release()
        for stream in streams.values():
            stream.close()

    result = {
        'scope': 'cache replay with identical source boxes and fixture filter; no neural inference',
        'accuracy_status': 'not_evaluated_no_complete_ground_truth',
        'frames': frames,
        'fps': fps,
        'video_sha256': meta['video_sha256'],
        'model': meta.get('model'),
        'detector_confidence': meta.get('confidence'),
        'raw_detections': raw_detections,
        'filtered_detections': filtered_detections,
        'exclude_confirmed_referees': exclude_confirmed_referees,
        'trackers': {},
    }
    for name, tracker in trackers.items():
        summary = metrics[name].summary()
        summary['mean_track_span_seconds'] = summary['mean_track_span_frames'] / fps
        summary['mean_continuous_run_seconds'] = summary['mean_continuous_run_frames'] / fps
        summary['median_continuous_run_seconds'] = summary['median_continuous_run_frames'] / fps
        result['trackers'][name] = {
            'track_observations': observations[name],
            'weak_track_observations': weak_observations[name],
            'clipped_output_boxes': clipped_output_boxes[name],
            'dropped_fully_outside_boxes': dropped_outside_boxes[name],
            'excluded_role_observations': excluded_role_observations[name],
            'metrics': summary,
            'output_jsonl': str(output_dir / f'{name}.jsonl'),
        }
    byte = trackers['bytetrack_standard']
    result['trackers']['bytetrack_standard']['implementation'] = {
        'package': 'ultralytics', 'version': byte.version, **byte.config,
    }
    destination = output_dir / 'comparison.json'
    destination.write_text(json.dumps(result, indent=2) + '\n')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', required=True)
    parser.add_argument('--cache', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--max-frames', type=int)
    parser.add_argument('--exclude-confirmed-referees', action='store_true')
    args = parser.parse_args()
    if args.max_frames is not None and args.max_frames <= 0:
        parser.error('--max-frames must be positive')
    print(json.dumps(compare(
        args.video, args.cache, args.out, args.max_frames,
        exclude_confirmed_referees=args.exclude_confirmed_referees,
    ), indent=2))


if __name__ == '__main__':
    main()

from __future__ import annotations

import json
from collections import Counter
from time import perf_counter
from math import isfinite
from pathlib import Path

from .metrics import TrackingMetrics
from .schema import frame_payload
from .tracking import CentroidTracker
from .visualization import draw_tracks


def analyze_video(
    input_path: str | Path,
    detector,
    *,
    output_jsonl: str | Path,
    output_video: str | Path | None = None,
    team_classifier=None,
    max_distance: float = 80.0,
    max_missed: int = 8,
    max_frames: int | None = None,
    temporal_teams: bool = False,
    velocity_alpha: float = 1.0,
) -> dict:
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError("OpenCV is not installed. Install the optional 'vision' dependencies.") from exc

    input_path = Path(input_path)
    output_jsonl = Path(output_jsonl)
    output_video_path = Path(output_video) if output_video else None
    if max_frames is not None and max_frames <= 0:
        raise ValueError('max_frames must be positive')
    paths = [input_path.resolve(), output_jsonl.resolve()]
    if output_video_path:
        paths.append(output_video_path.resolve())
    if len(set(paths)) != len(paths):
        raise ValueError('Input, JSONL and annotated video paths must be distinct')
    tracker = CentroidTracker(max_distance=max_distance, max_missed=max_missed, temporal_teams=temporal_teams, velocity_alpha=velocity_alpha)
    if not input_path.is_file():
        raise FileNotFoundError(input_path)

    capture = cv2.VideoCapture(str(input_path))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video: {input_path}")

    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    if not isfinite(fps) or fps <= 0 or width <= 0 or height <= 0:
        capture.release()
        raise RuntimeError('Invalid video metadata: reliable FPS and dimensions required')
    tracking_metrics = TrackingMetrics()
    output_jsonl.parent.mkdir(parents=True, exist_ok=True)

    writer = None
    if output_video_path:
        if width <= 0 or height <= 0:
            capture.release()
            raise RuntimeError("Input video has invalid dimensions; annotated output cannot be created.")
        output_video_path.parent.mkdir(parents=True, exist_ok=True)
        writer_fps = fps if fps > 0 else 25.0
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(output_video_path), fourcc, writer_fps, (width, height))
        if not writer.isOpened():
            capture.release()
            writer.release()
            raise RuntimeError(f"Could not create annotated video: {output_video_path}")

    frames = 0
    detections_total = 0
    team_labels_total = 0
    unique_track_ids: set[int] = set()
    teams = Counter()
    roles = Counter()
    output_teams = Counter()
    role_candidates = Counter()
    started = perf_counter()

    try:
        with output_jsonl.open("w", encoding="utf-8") as stream:
            while True:
                ok, frame = capture.read()
                if not ok:
                    break
                if max_frames is not None and frames >= max_frames:
                    break
                detections = detector.detect(frame)
                if team_classifier is not None:
                    detections = team_classifier.classify(frame, detections)
                team_labels_total += sum(1 for detection in detections if detection.team is not None)
                teams.update(d.team or 'unknown' for d in detections)
                roles.update(d.label for d in detections)
                tracks = tracker.update(detections)
                output_teams.update(t.detection.team or 'unknown' for t in tracks)
                role_candidates.update(t.detection.role_candidate or 'unknown' for t in tracks)
                tracking_metrics.observe(frames, tracks)
                detections_total += len(detections)
                unique_track_ids.update(track.track_id for track in tracks)
                timestamp_ms = (frames * 1000.0 / fps) if fps > 0 else 0.0
                payload = frame_payload(frame_index=frames, timestamp_ms=timestamp_ms, width=width, height=height, tracks=tracks)
                stream.write(json.dumps(payload, ensure_ascii=False) + "\n")
                if writer is not None:
                    writer.write(draw_tracks(frame, tracks))
                frames += 1
    finally:
        capture.release()
        if writer is not None:
            writer.release()

    elapsed_seconds = perf_counter() - started
    metrics = tracking_metrics.summary()
    metrics['mean_track_span_seconds'] = metrics['mean_track_span_frames'] / fps
    return {
        "frames_processed": frames,
        "detections_total": detections_total,
        "team_labels_total": team_labels_total,
        "team_label_rate": (team_labels_total / detections_total) if detections_total else 0.0,
        "unique_tracks": len(unique_track_ids),
        "fps": fps,
        "width": width,
        "height": height,
        "output_jsonl": str(output_jsonl),
        "output_video": str(output_video_path) if output_video_path else None,
        "tracking_metrics": metrics,
        "processing_seconds": elapsed_seconds,
        "processing_fps": frames / elapsed_seconds if elapsed_seconds else 0.0,
        "detections_by_team": dict(teams),
        "detections_by_role": dict(roles),
        "track_observations_by_team": dict(output_teams),
        "role_candidate_observations": dict(role_candidates),
        "temporal_teams": temporal_teams,
        "velocity_alpha": velocity_alpha,
        "identity_switches": None,
        "accuracy_status": "not_evaluated_no_ground_truth",
    }

from __future__ import annotations

import json
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
    max_distance: float = 80.0,
    max_missed: int = 8,
    max_frames: int | None = None,
) -> dict:
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError("OpenCV is not installed. Install the optional 'vision' dependencies.") from exc

    input_path = Path(input_path)
    output_jsonl = Path(output_jsonl)
    output_video_path = Path(output_video) if output_video else None
    if not input_path.is_file():
        raise FileNotFoundError(input_path)

    capture = cv2.VideoCapture(str(input_path))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video: {input_path}")

    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    tracker = CentroidTracker(max_distance=max_distance, max_missed=max_missed)
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
    unique_track_ids: set[int] = set()

    try:
        with output_jsonl.open("w", encoding="utf-8") as stream:
            while True:
                ok, frame = capture.read()
                if not ok:
                    break
                if max_frames is not None and frames >= max_frames:
                    break
                detections = detector.detect(frame)
                tracks = tracker.update(detections)
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

    return {
        "frames_processed": frames,
        "detections_total": detections_total,
        "unique_tracks": len(unique_track_ids),
        "fps": fps,
        "width": width,
        "height": height,
        "output_jsonl": str(output_jsonl),
        "output_video": str(output_video_path) if output_video_path else None,
        "tracking_metrics": tracking_metrics.summary(),
    }

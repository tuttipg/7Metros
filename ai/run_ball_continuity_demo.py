"""Render detector-backed temporal ball observations on a real handball clip.

The tracker may use weak detector boxes to continue a strong ball segment, but it
never interpolates or predicts a visible ball on frames without a detector box.
Player/team tracks are optional and are used only for visualization.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from sevenmetros_ai.ball import YoloSportsBallDetector
from sevenmetros_ai.ball_tracking import BallObservationTracker


def sha256_file(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def load_track_window(path, start_frame, end_frame):
    if path is None:
        return None
    rows = {}
    with Path(path).open(encoding="utf-8") as stream:
        for line in stream:
            payload = json.loads(line)
            frame = int(payload["frame_index"])
            if start_frame <= frame < end_frame:
                rows[frame] = payload
            if frame >= end_frame:
                break
    missing = [frame for frame in range(start_frame, end_frame) if frame not in rows]
    if missing:
        raise ValueError(f"Player tracks miss frame {missing[0]}")
    return rows


def _longest_run(frame_indexes):
    longest = current = 0
    previous = None
    for frame in sorted(frame_indexes):
        current = current + 1 if previous is None or frame == previous + 1 else 1
        longest = max(longest, current)
        previous = frame
    return longest


def run(video, model, output_video, output_jsonl, *, player_tracks=None, start_frame=0,
        frames=105, low_confidence=.02, high_confidence=.10, imgsz=960,
        max_missed=3, max_speed_px_per_frame=70.0, max_size_ratio=3.0,
        velocity_alpha=.4, expected_model_sha256=None):
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError("OpenCV is required for the visual demo") from exc
    video, model = Path(video), Path(model)
    output_video, output_jsonl = Path(output_video), Path(output_jsonl)
    player_tracks = Path(player_tracks) if player_tracks else None
    if frames <= 0 or start_frame < 0:
        raise ValueError("start_frame must be non-negative and frames positive")
    if not video.is_file() or not model.is_file():
        raise FileNotFoundError("video and model must exist")
    if player_tracks is not None and not player_tracks.is_file():
        raise FileNotFoundError(player_tracks)
    model_sha = sha256_file(model)
    if expected_model_sha256 and model_sha != expected_model_sha256.lower():
        raise ValueError("Model SHA256 mismatch")
    end_frame = start_frame + frames
    player_rows = load_track_window(player_tracks, start_frame, end_frame)
    detector = YoloSportsBallDetector(model, confidence=low_confidence, imgsz=imgsz)
    tracker = BallObservationTracker(
        low_threshold=low_confidence, high_threshold=high_confidence,
        max_missed=max_missed, max_speed_px_per_frame=max_speed_px_per_frame,
        max_size_ratio=max_size_ratio, velocity_alpha=velocity_alpha,
    )
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {video}")
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    if fps <= 0 or width <= 0 or height <= 0:
        cap.release(); raise RuntimeError("Invalid video metadata")
    output_video.parent.mkdir(parents=True, exist_ok=True)
    output_jsonl.parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(str(output_video), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    if not writer.isOpened():
        cap.release(); raise RuntimeError(f"Could not open video writer: {output_video}")
    raw_candidates = raw_candidate_frames = 0
    selected_frames = []
    strong_selected = weak_selected = 0
    segments = set()
    try:
        with output_jsonl.open("w", encoding="utf-8") as stream:
            for frame_index in range(start_frame, end_frame):
                ok, frame = cap.read()
                if not ok:
                    raise RuntimeError(f"Video ended at frame {frame_index}")
                candidates = detector.detect(frame.copy())
                raw_candidates += len(candidates)
                raw_candidate_frames += int(bool(candidates))
                observation = tracker.update(frame_index, candidates)
                if player_rows is not None:
                    for obj in player_rows[frame_index].get("objects", []):
                        x1, y1, x2, y2 = [int(round(v)) for v in obj["bbox_xyxy"]]
                        team = obj.get("team") or "unknown"
                        color = ((70, 170, 70) if team == "Ferro" else (180, 90, 40) if team == "Lujan" else (170, 170, 170))
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                        cv2.putText(frame, f"#{obj['track_id']} {team}", (x1, max(15, y1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, .42, color, 1, cv2.LINE_AA)
                serialized = None
                if observation is not None:
                    detection = observation.detection
                    selected_frames.append(frame_index)
                    segments.add(observation.segment_id)
                    if observation.stage == "strong":
                        strong_selected += 1; color = (0, 255, 255)
                    else:
                        weak_selected += 1; color = (0, 165, 255)
                    x1, y1, x2, y2 = map(int, (detection.x1, detection.y1, detection.x2, detection.y2))
                    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                    radius = max(8, int(max(x2 - x1, y2 - y1) * .8))
                    cv2.circle(frame, (cx, cy), radius, color, 3)
                    cv2.putText(frame, f"BALL OBS {observation.stage} {detection.confidence:.2f} s{observation.segment_id}", (max(0, x1 - 8), max(20, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, .48, color, 2, cv2.LINE_AA)
                    serialized = {
                        "detector_backed": True, "stage": observation.stage,
                        "segment_id": observation.segment_id,
                        "gap_from_previous": observation.gap_from_previous,
                        "confidence": round(detection.confidence, 6),
                        "bbox_xyxy": [round(v, 3) for v in (detection.x1, detection.y1, detection.x2, detection.y2)],
                    }
                status = f"ball: observed {observation.stage}" if observation is not None else "ball: no observed candidate"
                cv2.rectangle(frame, (8, 8), (430, 66), (20, 20, 20), -1)
                cv2.putText(frame, "7Metros | detector-backed ball continuity", (18, 31), cv2.FONT_HERSHEY_SIMPLEX, .55, (255, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(frame, status, (18, 55), cv2.FONT_HERSHEY_SIMPLEX, .5, (0, 255, 255) if observation is not None else (180, 180, 180), 1, cv2.LINE_AA)
                writer.write(frame)
                stream.write(json.dumps({
                    "schema": "7metros-ai.ball-observations.v1",
                    "frame_index": frame_index,
                    "timestamp_ms": round(frame_index * 1000.0 / fps, 3),
                    "observation": serialized,
                }) + "\n")
    finally:
        cap.release(); writer.release()
    return {
        "status": "UNVERIFIED_BALL_CONTINUITY_NO_BALL_GT",
        "frames": frames, "start_frame": start_frame,
        "detector": {"low_confidence": float(low_confidence), "high_confidence": float(high_confidence), "imgsz": int(imgsz)},
        "association": {
            "max_missed": int(max_missed), "max_speed_px_per_frame": float(max_speed_px_per_frame),
            "max_size_ratio": float(max_size_ratio), "velocity_alpha": float(velocity_alpha),
            "emits_synthetic_positions": False,
        },
        "raw_candidate_frames": raw_candidate_frames, "raw_candidates": raw_candidates,
        "selected_frames": len(selected_frames), "selected_strong": strong_selected,
        "selected_weak": weak_selected, "segments": len(segments),
        "longest_observed_run": _longest_run(selected_frames), "model_sha256": model_sha,
        "output_video": str(output_video), "output_jsonl": str(output_jsonl),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--output-video", required=True)
    parser.add_argument("--output-jsonl", required=True)
    parser.add_argument("--player-tracks")
    parser.add_argument("--start-frame", type=int, default=0)
    parser.add_argument("--frames", type=int, default=105)
    parser.add_argument("--low-confidence", type=float, default=.02)
    parser.add_argument("--high-confidence", type=float, default=.10)
    parser.add_argument("--imgsz", type=int, default=960)
    parser.add_argument("--max-missed", type=int, default=3)
    parser.add_argument("--max-speed-px-per-frame", type=float, default=70.0)
    parser.add_argument("--max-size-ratio", type=float, default=3.0)
    parser.add_argument("--velocity-alpha", type=float, default=.4)
    parser.add_argument("--expected-model-sha256")
    args = parser.parse_args()
    print(json.dumps(run(**vars(args)), indent=2))


if __name__ == "__main__":
    main()

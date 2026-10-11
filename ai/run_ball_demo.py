"""Render an honest player/team + sports-ball candidate demo on a real clip.

The output deliberately says "not detected" when no ball candidate exists. It does
not interpolate ball positions and does not infer possession or events.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from sevenmetros_ai.ball import YoloSportsBallDetector
from sevenmetros_ai.fixture_filter import blue_court_present


def sha256_file(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def load_track_window(path, start_frame, end_frame):
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


def run(video, player_tracks, model, output_video, output_jsonl, *, start_frame=0,
        frames=105, confidence=.05, imgsz=640, expected_model_sha256=None,
        require_blue_court=False, min_blue_court_fraction=.15):
    try:
        import cv2
    except ImportError as exc:  # pragma: no cover - optional vision runtime
        raise RuntimeError("OpenCV is required for the visual demo") from exc
    video, player_tracks, model = map(Path, (video, player_tracks, model))
    output_video, output_jsonl = Path(output_video), Path(output_jsonl)
    if frames <= 0 or start_frame < 0:
        raise ValueError("start_frame must be non-negative and frames positive")
    if not video.is_file() or not player_tracks.is_file() or not model.is_file():
        raise FileNotFoundError("video, tracks and model must exist")
    model_sha = sha256_file(model)
    if expected_model_sha256 and model_sha != expected_model_sha256.lower():
        raise ValueError("Model SHA256 mismatch")
    end_frame = start_frame + frames
    player_rows = load_track_window(player_tracks, start_frame, end_frame)
    detector = YoloSportsBallDetector(model, confidence=confidence, imgsz=imgsz)

    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {video}")
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    if fps <= 0 or width <= 0 or height <= 0:
        cap.release()
        raise RuntimeError("Invalid video metadata")
    output_video.parent.mkdir(parents=True, exist_ok=True)
    output_jsonl.parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(
        str(output_video), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height)
    )
    if not writer.isOpened():
        cap.release()
        raise RuntimeError(f"Could not open video writer: {output_video}")

    candidate_count = candidate_frames = scene_guard_removed = 0
    try:
        with output_jsonl.open("w", encoding="utf-8") as stream:
            for frame_index in range(start_frame, end_frame):
                ok, frame = cap.read()
                if not ok:
                    raise RuntimeError(f"Video ended at frame {frame_index}")
                clean = frame.copy()
                candidates = detector.detect(clean)
                court_present = None
                if require_blue_court:
                    court_present = blue_court_present(
                        clean, min_fraction=min_blue_court_fraction,
                    )
                    if not court_present:
                        scene_guard_removed += len(candidates)
                        candidates = []
                if candidates:
                    candidate_frames += 1
                    candidate_count += len(candidates)

                for obj in player_rows[frame_index].get("objects", []):
                    x1, y1, x2, y2 = [int(round(v)) for v in obj["bbox_xyxy"]]
                    team = obj.get("team") or "unknown"
                    color = ((70, 170, 70) if team == "Ferro" else
                             (180, 90, 40) if team == "Lujan" else (170, 170, 170))
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(
                        frame, f"#{obj['track_id']} {team}", (x1, max(15, y1 - 5)),
                        cv2.FONT_HERSHEY_SIMPLEX, .42, color, 1, cv2.LINE_AA,
                    )

                serialized = []
                for candidate in candidates:
                    x1, y1, x2, y2 = map(int, (
                        candidate.x1, candidate.y1, candidate.x2, candidate.y2,
                    ))
                    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                    radius = max(8, int(max(x2 - x1, y2 - y1) * .8))
                    cv2.circle(frame, (cx, cy), radius, (0, 255, 255), 3)
                    cv2.putText(
                        frame, f"BALL? {candidate.confidence:.2f}",
                        (max(0, x1 - 8), max(20, y1 - 10)),
                        cv2.FONT_HERSHEY_SIMPLEX, .52, (0, 255, 255), 2, cv2.LINE_AA,
                    )
                    serialized.append({
                        "confidence": round(candidate.confidence, 6),
                        "bbox_xyxy": [round(v, 3) for v in (
                            candidate.x1, candidate.y1, candidate.x2, candidate.y2
                        )],
                    })
                status = f"ball candidates: {len(candidates)}" if candidates else "ball: not detected"
                cv2.rectangle(frame, (8, 8), (360, 66), (20, 20, 20), -1)
                cv2.putText(frame, "7Metros | player/team + ball baseline", (18, 31),
                            cv2.FONT_HERSHEY_SIMPLEX, .55, (255, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(frame, status, (18, 55), cv2.FONT_HERSHEY_SIMPLEX, .5,
                            (0, 255, 255) if candidates else (180, 180, 180), 1, cv2.LINE_AA)
                writer.write(frame)
                stream.write(json.dumps({
                    "schema": "7metros-ai.ball-candidates.v1",
                    "frame_index": frame_index,
                    "timestamp_ms": round(frame_index * 1000.0 / fps, 3),
                    "ball_candidates": serialized,
                    "blue_court_guard": {
                        "enabled": bool(require_blue_court),
                        "court_present": court_present,
                    },
                }) + "\n")
    finally:
        cap.release(); writer.release()

    return {
        "status": "UNVERIFIED_BALL_BASELINE_NO_BALL_GT",
        "frames": frames,
        "start_frame": start_frame,
        "confidence": float(confidence),
        "imgsz": int(imgsz),
        "candidate_frames": candidate_frames,
        "candidates": candidate_count,
        "blue_court_guard_enabled": bool(require_blue_court),
        "min_blue_court_fraction": (
            float(min_blue_court_fraction) if require_blue_court else None
        ),
        "scene_guard_removed_candidates": scene_guard_removed,
        "model_sha256": model_sha,
        "output_video": str(output_video),
        "output_jsonl": str(output_jsonl),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True)
    parser.add_argument("--player-tracks", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--output-video", required=True)
    parser.add_argument("--output-jsonl", required=True)
    parser.add_argument("--start-frame", type=int, default=0)
    parser.add_argument("--frames", type=int, default=105)
    parser.add_argument("--confidence", type=float, default=.05)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--expected-model-sha256")
    parser.add_argument("--require-blue-court", action="store_true")
    parser.add_argument("--min-blue-court-fraction", type=float, default=.15)
    args = parser.parse_args()
    print(json.dumps(run(**vars(args)), indent=2))


if __name__ == "__main__":
    main()

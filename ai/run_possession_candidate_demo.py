"""Render conservative frame-level possession candidates.

Possession is never carried through frames where the ball is unobserved. On a
frame with a detector-backed ball observation, the closest player is only marked
`POS?` when normalized edge distance and nearest-vs-second margin pass guardrails.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path

from sevenmetros_ai.ball_tracking import BallObservation
from sevenmetros_ai.possession import assign_possession_candidate
from sevenmetros_ai.tracking import Detection, Track


def _load_jsonl_window(path, start_frame, end_frame):
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
        raise ValueError(f"{path} misses frame {missing[0]}")
    return rows


def _player_track(obj):
    x1, y1, x2, y2 = [float(v) for v in obj["bbox_xyxy"]]
    team = obj.get("team")
    detection = Detection(
        x1=x1, y1=y1, x2=x2, y2=y2,
        confidence=float(obj.get("confidence", 1.0)), label="player", team=team,
    )
    return Track(track_id=int(obj["track_id"]), detection=detection, association_team=team)


def _ball_observation(payload):
    obj = payload.get("observation")
    if obj is None:
        return None
    x1, y1, x2, y2 = [float(v) for v in obj["bbox_xyxy"]]
    detection = Detection(
        x1=x1, y1=y1, x2=x2, y2=y2,
        confidence=float(obj["confidence"]), label="ball",
    )
    return BallObservation(
        detection=detection, segment_id=int(obj["segment_id"]),
        stage=str(obj["stage"]), frame_index=int(payload["frame_index"]),
        gap_from_previous=obj.get("gap_from_previous"),
    )


def run(video, player_tracks, ball_observations, output_video, output_jsonl, *,
        start_frame=105, frames=105, max_normalized_distance=.35,
        min_margin_to_second=.08):
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError("OpenCV is required for the visual demo") from exc
    video, player_tracks, ball_observations = map(Path, (video, player_tracks, ball_observations))
    output_video, output_jsonl = Path(output_video), Path(output_jsonl)
    if frames <= 0 or start_frame < 0:
        raise ValueError("start_frame must be non-negative and frames positive")
    for path in (video, player_tracks, ball_observations):
        if not path.is_file(): raise FileNotFoundError(path)
    end_frame = start_frame + frames
    players_by_frame = _load_jsonl_window(player_tracks, start_frame, end_frame)
    balls_by_frame = _load_jsonl_window(ball_observations, start_frame, end_frame)
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened(): raise RuntimeError(f"Could not open video: {video}")
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

    state_counts, team_counts = Counter(), Counter()
    candidate_runs, current_run = [], None
    try:
        with output_jsonl.open("w", encoding="utf-8") as stream:
            for frame_index in range(start_frame, end_frame):
                ok, frame = cap.read()
                if not ok: raise RuntimeError(f"Video ended at frame {frame_index}")
                player_objects = players_by_frame[frame_index].get("objects", [])
                tracks = [_player_track(obj) for obj in player_objects]
                ball = _ball_observation(balls_by_frame[frame_index])
                result = assign_possession_candidate(
                    ball, tracks,
                    max_normalized_distance=max_normalized_distance,
                    min_margin_to_second=min_margin_to_second,
                )
                state_counts[result.state] += 1
                if result.state == "candidate": team_counts[result.team or "unknown"] += 1
                selected_obj = None
                for obj in player_objects:
                    x1, y1, x2, y2 = [int(round(v)) for v in obj["bbox_xyxy"]]
                    team = obj.get("team") or "unknown"
                    color = ((70, 170, 70) if team == "Ferro" else (180, 90, 40) if team == "Lujan" else (150, 150, 150))
                    thickness = 1
                    if result.state == "candidate" and int(obj["track_id"]) == result.track_id:
                        selected_obj, color, thickness = obj, (0, 255, 0), 3
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)
                    cv2.putText(frame, f"#{obj['track_id']} {team}", (x1, max(15, y1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, .40, color, 1, cv2.LINE_AA)
                if ball is not None:
                    det = ball.detection; bx, by = int(round(det.cx)), int(round(det.cy))
                    cv2.circle(frame, (bx, by), 9, (0, 255, 255), 3)
                    if selected_obj is not None:
                        x1, y1, x2, y2 = selected_obj["bbox_xyxy"]
                        pcx, pcy = int(round((x1 + x2) / 2)), int(round((y1 + y2) / 2))
                        cv2.line(frame, (bx, by), (pcx, pcy), (0, 255, 0), 2)
                if result.state == "candidate":
                    status = f"POS? #{result.track_id} {result.team or 'unknown'}"; status_color = (0, 255, 0)
                    key = (result.track_id, result.team)
                    if current_run and current_run["key"] == key and frame_index == current_run["end"] + 1:
                        current_run["end"] = frame_index; current_run["frames"] += 1
                    else:
                        if current_run: candidate_runs.append(current_run)
                        current_run = {"key": key, "start": frame_index, "end": frame_index, "frames": 1}
                else:
                    if current_run: candidate_runs.append(current_run); current_run = None
                    status = {
                        "ball_unobserved": "possession: unknown (ball unobserved)",
                        "observed_ambiguous": "possession: ambiguous",
                        "observed_unassigned": "possession: unassigned",
                    }[result.state]
                    status_color = (0, 165, 255) if result.state == "observed_ambiguous" else (180, 180, 180)
                cv2.rectangle(frame, (8, 8), (500, 68), (20, 20, 20), -1)
                cv2.putText(frame, "7Metros | observed-ball possession candidates", (18, 31), cv2.FONT_HERSHEY_SIMPLEX, .54, (255, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(frame, status, (18, 56), cv2.FONT_HERSHEY_SIMPLEX, .5, status_color, 1, cv2.LINE_AA)
                writer.write(frame)
                stream.write(json.dumps({
                    "schema": "7metros-ai.possession-candidates.v1",
                    "frame_index": frame_index,
                    "timestamp_ms": round(frame_index * 1000.0 / fps, 3),
                    "ball_observed": ball is not None,
                    "state": result.state, "track_id": result.track_id, "team": result.team,
                    "normalized_distance": result.normalized_distance,
                    "margin_to_second": result.margin_to_second,
                    "ball_segment_id": result.ball_segment_id,
                }) + "\n")
    finally:
        if current_run: candidate_runs.append(current_run)
        cap.release(); writer.release()
    return {
        "status": "UNVERIFIED_POSSESSION_CANDIDATES_NO_POSSESSION_GT",
        "frames": frames, "start_frame": start_frame,
        "settings": {
            "max_normalized_distance": float(max_normalized_distance),
            "min_margin_to_second": float(min_margin_to_second),
            "temporal_carry_forward": False, "requires_observed_ball": True,
        },
        "states": dict(state_counts), "candidate_teams": dict(team_counts),
        "candidate_runs": [
            {"track_id": r["key"][0], "team": r["key"][1], "start_frame": r["start"],
             "end_frame": r["end"], "frames": r["frames"]} for r in candidate_runs
        ],
        "output_video": str(output_video), "output_jsonl": str(output_jsonl),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True)
    parser.add_argument("--player-tracks", required=True)
    parser.add_argument("--ball-observations", required=True)
    parser.add_argument("--output-video", required=True)
    parser.add_argument("--output-jsonl", required=True)
    parser.add_argument("--start-frame", type=int, default=105)
    parser.add_argument("--frames", type=int, default=105)
    parser.add_argument("--max-normalized-distance", type=float, default=.35)
    parser.add_argument("--min-margin-to-second", type=float, default=.08)
    args = parser.parse_args()
    print(json.dumps(run(**vars(args)), indent=2))


if __name__ == "__main__": main()

"""Falsification benchmark for temporal small-ball motion proposals.

The output is diagnostic.  Motion blobs and tracklets are never labelled as
ball, shot or goal without human ball ground truth.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from math import hypot
from pathlib import Path

from sevenmetros_ai.shot_geometry import goal_mouth_proxies, _ray_box_intersection
from sevenmetros_ai.temporal_ball_motion import TemporalMotionBallProposer, link_motion_candidates


def load_jsonl(path, key="frame_index"):
    rows = {}
    with Path(path).open(encoding="utf-8") as stream:
        for line in stream:
            row = json.loads(line)
            rows[int(row[key])] = row
    return rows


def sha256_file(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def parse_window(value):
    label, interval = value.split("=", 1)
    start, end = [int(item) for item in interval.split(":", 1)]
    if not label or start < 1 or end <= start:
        raise argparse.ArgumentTypeError("window must be label=start:end with start >= 1")
    return label, start, end


def _reference_center(row):
    observation = row.get("observation")
    if observation is None:
        return None
    x1, y1, x2, y2 = [float(value) for value in observation["bbox_xyxy"]]
    return (x1 + x2) / 2, (y1 + y2) / 2


def _goal_directed(tracklet, player_row):
    points = tracklet.points
    dt = tracklet.end_frame - tracklet.start_frame
    x0, y0 = points[0].center_xy
    x1, y1 = points[-1].center_xy
    vx, vy = (x1 - x0) / dt, (y1 - y0) / dt
    return any(
        _ray_box_intersection(x1, y1, vx, vy, proxy.bbox_xyxy, 30) is not None
        for proxy in goal_mouth_proxies(player_row)
    )


def benchmark(video, tracks, windows, *, reference_ball=None):
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError("OpenCV is required") from exc
    player_rows = load_jsonl(tracks)
    reference_rows = load_jsonl(reference_ball) if reference_ball else {}
    proposer = TemporalMotionBallProposer()
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {video}")
    result = {
        "status": "TEMPORAL_MOTION_DIAGNOSTIC_NOT_BALL_ACCURACY",
        "inputs": {
            "video_sha256": sha256_file(video),
            "tracks_sha256": sha256_file(tracks),
            "reference_ball_sha256": sha256_file(reference_ball) if reference_ball else None,
            "reference_note": "Detector-backed observations are controls, not human ball ground truth.",
        },
        "windows": {},
        "settings": {
            "difference_threshold": proposer.difference_threshold,
            "min_area": proposer.min_area,
            "max_area": proposer.max_area,
            "max_side": proposer.max_side,
            "min_darkness": proposer.min_darkness,
            "tracklet_min_frames": 3,
            "tracklet_min_speed": 8,
            "tracklet_min_linearity": .7,
        },
    }
    try:
        for label, start, end in windows:
            cap.set(cv2.CAP_PROP_POS_FRAMES, start - 1)
            frames = []
            # Previous context + [start,end) + one following context frame.
            for _ in range(end - start + 2):
                ok, frame = cap.read()
                if not ok:
                    raise RuntimeError(f"Video ended in {label}")
                frames.append(frame)
            candidate_rows = []
            recovered = reference_points = 0
            distances = []
            for offset in range(1, len(frames) - 1):
                frame_index = start + offset - 1
                boxes = [obj["bbox_xyxy"] for obj in player_rows[frame_index].get("objects", [])]
                candidates = proposer.propose(
                    frames[offset - 1], frames[offset], frames[offset + 1], boxes,
                )
                candidate_rows.append((frame_index, candidates))
                center = _reference_center(reference_rows.get(frame_index, {}))
                if center is not None:
                    reference_points += 1
                    if candidates:
                        distance = min(hypot(item.center_xy[0] - center[0],
                                             item.center_xy[1] - center[1])
                                       for item in candidates)
                        distances.append(distance)
                        recovered += int(distance <= 5)
            tracklets = link_motion_candidates(candidate_rows)
            qualified = [item for item in tracklets if item.frames >= 3
                         and item.mean_speed >= 8 and item.linearity >= .7]
            directed = [item for item in qualified
                        if _goal_directed(item, player_rows[item.end_frame])]
            result["windows"][label] = {
                "fixture_frames": [start, end],
                "motion_candidate_frames": sum(bool(items) for _, items in candidate_rows),
                "motion_candidates": sum(len(items) for _, items in candidate_rows),
                "qualified_tracklets": len(qualified),
                "goal_directed_tracklets": len(directed),
                "reference_points": reference_points,
                "reference_points_recovered_within_5px": recovered,
                "reference_median_error_px": (
                    sorted(distances)[len(distances) // 2] if distances else None
                ),
            }
    finally:
        cap.release()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True)
    parser.add_argument("--tracks", required=True)
    parser.add_argument("--reference-ball")
    parser.add_argument("--window", action="append", type=parse_window, required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    result = benchmark(args.video, args.tracks, args.window,
                       reference_ball=args.reference_ball)
    output = Path(args.output)
    if output.exists():
        raise ValueError(f"Output already exists: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

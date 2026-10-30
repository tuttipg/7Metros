"""Render conservative control-change event candidates over the real clip.

Stable POS? runs are required on both sides of a short gap. The result is labeled
CONTROL CHANGE? rather than pass/turnover because there is no event ground truth.
"""
from __future__ import annotations

import argparse
from dataclasses import asdict
import json
from pathlib import Path

from sevenmetros_ai.events import detect_control_change_candidates, stable_candidate_runs


def _load(path):
    with Path(path).open(encoding='utf-8') as stream:
        return [json.loads(line) for line in stream if line.strip()]


def _load_players(path):
    return {int(r['frame_index']): r for r in _load(path)}


def run(video, possession_candidates, player_tracks, output_video, output_json, *,
        start_frame=105, frames=105, min_run_frames=2, max_transition_gap_frames=4,
        banner_frames=12):
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError('OpenCV is required for the visual demo') from exc
    video, possession_candidates, player_tracks = map(Path, (video, possession_candidates, player_tracks))
    output_video, output_json = Path(output_video), Path(output_json)
    for path in (video, possession_candidates, player_tracks):
        if not path.is_file(): raise FileNotFoundError(path)
    rows = _load(possession_candidates)
    rows = [r for r in rows if start_frame <= int(r['frame_index']) < start_frame + frames]
    if len(rows) != frames:
        raise ValueError('possession stream does not cover requested frames exactly')
    runs = stable_candidate_runs(rows, min_run_frames=min_run_frames)
    events = detect_control_change_candidates(
        rows, min_run_frames=min_run_frames,
        max_transition_gap_frames=max_transition_gap_frames,
    )
    players = _load_players(player_tracks)
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened(): raise RuntimeError(f'Could not open video: {video}')
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    if fps <= 0 or width <= 0 or height <= 0:
        cap.release(); raise RuntimeError('Invalid video metadata')
    output_video.parent.mkdir(parents=True, exist_ok=True)
    output_json.parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(str(output_video), cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))
    if not writer.isOpened(): cap.release(); raise RuntimeError('Could not open writer')
    event_by_frame = {e.frame_index: e for e in events}
    active_event = None
    active_until = -1
    try:
        for frame_index in range(start_frame, start_frame + frames):
            ok, frame = cap.read()
            if not ok: raise RuntimeError(f'Video ended at {frame_index}')
            for obj in players.get(frame_index, {}).get('objects', []):
                x1, y1, x2, y2 = [int(round(v)) for v in obj['bbox_xyxy']]
                team = obj.get('team') or 'unknown'
                color = (70,170,70) if team == 'Ferro' else (180,90,40) if team == 'Lujan' else (150,150,150)
                cv2.rectangle(frame, (x1,y1), (x2,y2), color, 1)
                cv2.putText(frame, f"#{obj['track_id']} {team}", (x1,max(15,y1-4)), cv2.FONT_HERSHEY_SIMPLEX,.38,color,1,cv2.LINE_AA)
            if frame_index in event_by_frame:
                active_event = event_by_frame[frame_index]
                active_until = frame_index + max(1, int(banner_frames)) - 1
            cv2.rectangle(frame, (8,8), (650,68), (20,20,20), -1)
            cv2.putText(frame, '7Metros | conservative event candidates', (18,31), cv2.FONT_HERSHEY_SIMPLEX,.55,(255,255,255),1,cv2.LINE_AA)
            if active_event is not None and frame_index <= active_until:
                source = f"#{active_event.source_track_id} {active_event.source_team or 'unknown'}"
                target = f"#{active_event.target_track_id} {active_event.target_team or 'unknown'}"
                text = f"CONTROL CHANGE? {source} -> {target}"
                color = (0,165,255)
            else:
                text = 'event: none confirmed'; color = (170,170,170)
            cv2.putText(frame, text, (18,56), cv2.FONT_HERSHEY_SIMPLEX,.50,color,1,cv2.LINE_AA)
            writer.write(frame)
    finally:
        cap.release(); writer.release()
    payload = {
        'status': 'UNVERIFIED_CONTROL_CHANGE_CANDIDATES_NO_EVENT_GT',
        'frames': frames, 'start_frame': start_frame,
        'settings': {'min_run_frames': int(min_run_frames), 'max_transition_gap_frames': int(max_transition_gap_frames)},
        'stable_runs': [asdict(r) for r in runs],
        'events': [asdict(e) for e in events],
        'confirmed_events': 0,
        'accuracy_metrics': None,
    }
    output_json.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
    return payload


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', required=True)
    parser.add_argument('--possession-candidates', required=True)
    parser.add_argument('--player-tracks', required=True)
    parser.add_argument('--output-video', required=True)
    parser.add_argument('--output-json', required=True)
    parser.add_argument('--start-frame', type=int, default=105)
    parser.add_argument('--frames', type=int, default=105)
    parser.add_argument('--min-run-frames', type=int, default=2)
    parser.add_argument('--max-transition-gap-frames', type=int, default=4)
    parser.add_argument('--banner-frames', type=int, default=12)
    args = parser.parse_args()
    print(json.dumps(run(**vars(args)), indent=2))


if __name__ == '__main__': main()

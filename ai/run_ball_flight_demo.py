"""Render detector-backed free-ball flight candidates on a real clip."""
from __future__ import annotations

import argparse
from dataclasses import asdict
import json
from pathlib import Path

from sevenmetros_ai.ball_flight import detect_free_ball_flights


def _load(path):
    with Path(path).open(encoding='utf-8') as stream:
        return [json.loads(line) for line in stream if line.strip()]


def run(video, ball_observations, possession_candidates, player_tracks, output_video, output_json, *,
        start_frame=105, frames=105, min_frames=3, min_mean_speed_px_per_frame=8.0,
        min_linearity=.70):
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError('OpenCV is required for visual demo') from exc
    video, ball_observations, possession_candidates, player_tracks = map(
        Path, (video, ball_observations, possession_candidates, player_tracks)
    )
    output_video, output_json = Path(output_video), Path(output_json)
    for path in (video, ball_observations, possession_candidates, player_tracks):
        if not path.is_file(): raise FileNotFoundError(path)
    balls = [r for r in _load(ball_observations) if start_frame <= int(r['frame_index']) < start_frame+frames]
    pos = [r for r in _load(possession_candidates) if start_frame <= int(r['frame_index']) < start_frame+frames]
    players = {int(r['frame_index']): r for r in _load(player_tracks)}
    if len(balls) != frames or len(pos) != frames:
        raise ValueError('input streams must cover requested window exactly')
    flights = detect_free_ball_flights(
        balls, pos, min_frames=min_frames,
        min_mean_speed_px_per_frame=min_mean_speed_px_per_frame,
        min_linearity=min_linearity,
    )
    flight_by_frame = {}
    for index, flight in enumerate(flights, 1):
        for frame in range(flight.start_frame, flight.end_frame + 1):
            flight_by_frame[frame] = (index, flight)
    ball_by_frame = {int(r['frame_index']): r for r in balls}
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
    writer = cv2.VideoWriter(str(output_video), cv2.VideoWriter_fourcc(*'mp4v'), fps, (width,height))
    if not writer.isOpened(): cap.release(); raise RuntimeError('Could not open writer')
    try:
        for frame_index in range(start_frame, start_frame+frames):
            ok, frame = cap.read()
            if not ok: raise RuntimeError(f'Video ended at {frame_index}')
            for obj in players.get(frame_index, {}).get('objects', []):
                x1,y1,x2,y2=[int(round(v)) for v in obj['bbox_xyxy']]
                team=obj.get('team') or 'unknown'
                color=(70,170,70) if team=='Ferro' else (180,90,40) if team=='Lujan' else (150,150,150)
                cv2.rectangle(frame,(x1,y1),(x2,y2),color,1)
                cv2.putText(frame,f"#{obj['track_id']} {team}",(x1,max(15,y1-4)),cv2.FONT_HERSHEY_SIMPLEX,.38,color,1,cv2.LINE_AA)
            obs = ball_by_frame[frame_index].get('observation')
            if obs is not None:
                x1,y1,x2,y2=obs['bbox_xyxy']; bx,by=int(round((x1+x2)/2)),int(round((y1+y2)/2))
                cv2.circle(frame,(bx,by),9,(0,255,255),3)
            cv2.rectangle(frame,(8,8),(650,68),(20,20,20),-1)
            cv2.putText(frame,'7Metros | detector-backed free-ball flight',(18,31),cv2.FONT_HERSHEY_SIMPLEX,.55,(255,255,255),1,cv2.LINE_AA)
            if frame_index in flight_by_frame:
                idx, flight = flight_by_frame[frame_index]
                text=f"BALL FLIGHT? #{idx} mean {flight.mean_speed_px_per_frame:.1f}px/fr lin {flight.linearity:.2f}"
                color=(0,165,255)
            else:
                text='flight: none'; color=(170,170,170)
            cv2.putText(frame,text,(18,56),cv2.FONT_HERSHEY_SIMPLEX,.50,color,1,cv2.LINE_AA)
            writer.write(frame)
    finally:
        cap.release(); writer.release()
    payload={
        'status':'UNVERIFIED_FREE_BALL_FLIGHT_CANDIDATES_NO_BALL_GT',
        'frames':frames,'start_frame':start_frame,
        'settings':{'min_frames':int(min_frames),'min_mean_speed_px_per_frame':float(min_mean_speed_px_per_frame),'min_linearity':float(min_linearity)},
        'flights':[asdict(f) for f in flights],
        'confirmed_shots':0,'accuracy_metrics':None,
    }
    output_json.write_text(json.dumps(payload,indent=2)+'\n',encoding='utf-8')
    return payload


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video',required=True)
    parser.add_argument('--ball-observations',required=True)
    parser.add_argument('--possession-candidates',required=True)
    parser.add_argument('--player-tracks',required=True)
    parser.add_argument('--output-video',required=True)
    parser.add_argument('--output-json',required=True)
    parser.add_argument('--start-frame',type=int,default=105)
    parser.add_argument('--frames',type=int,default=105)
    parser.add_argument('--min-frames',type=int,default=3)
    parser.add_argument('--min-mean-speed-px-per-frame',type=float,default=8.0)
    parser.add_argument('--min-linearity',type=float,default=.70)
    args=parser.parse_args(); print(json.dumps(run(**vars(args)),indent=2))


if __name__=='__main__': main()

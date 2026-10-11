"""Integrated 7Metros handball-analysis demo from retained detector-backed streams.

Combines player/team tracks, observed ball, conservative possession candidates,
free-ball flight candidates and control-change candidates. All semantic outputs
remain visibly marked with '?' because no possession/event ground truth exists.
"""
from __future__ import annotations

import argparse
from collections import Counter, deque
from dataclasses import asdict
import json
from pathlib import Path

from sevenmetros_ai.ball_flight import detect_free_ball_flights
from sevenmetros_ai.events import detect_control_change_candidates, stable_candidate_runs


def _load(path):
    with Path(path).open(encoding='utf-8') as stream:
        return [json.loads(line) for line in stream if line.strip()]


def run(video, player_tracks, ball_observations, possession_candidates, output_video, output_json, *,
        start_frame=105, frames=105, min_stable_run_frames=2, max_transition_gap_frames=4,
        min_flight_frames=3, min_flight_speed=8.0, min_flight_linearity=.70):
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError('OpenCV is required for visual demo') from exc
    video, player_tracks, ball_observations, possession_candidates = map(
        Path, (video, player_tracks, ball_observations, possession_candidates)
    )
    output_video, output_json = Path(output_video), Path(output_json)
    for path in (video, player_tracks, ball_observations, possession_candidates):
        if not path.is_file(): raise FileNotFoundError(path)
    end_frame = start_frame + frames
    player_rows = {int(r['frame_index']): r for r in _load(player_tracks)}
    balls = [r for r in _load(ball_observations) if start_frame <= int(r['frame_index']) < end_frame]
    pos = [r for r in _load(possession_candidates) if start_frame <= int(r['frame_index']) < end_frame]
    if len(balls) != frames or len(pos) != frames:
        raise ValueError('ball/possession streams must cover requested window exactly')
    ball_rows = {int(r['frame_index']): r for r in balls}
    pos_rows = {int(r['frame_index']): r for r in pos}
    stable_runs = stable_candidate_runs(pos, min_run_frames=min_stable_run_frames)
    events = detect_control_change_candidates(
        pos, min_run_frames=min_stable_run_frames,
        max_transition_gap_frames=max_transition_gap_frames,
    )
    flights = detect_free_ball_flights(
        balls, pos, min_frames=min_flight_frames,
        min_mean_speed_px_per_frame=min_flight_speed,
        min_linearity=min_flight_linearity,
    )
    flight_by_frame = {}
    for index, flight in enumerate(flights, 1):
        for frame in range(flight.start_frame, flight.end_frame + 1):
            flight_by_frame[frame] = (index, flight)
    event_by_frame = {e.frame_index: e for e in events}
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
    trail = deque(maxlen=10)
    active_event = None; event_until = -1
    try:
        for frame_index in range(start_frame, end_frame):
            ok, frame = cap.read()
            if not ok: raise RuntimeError(f'Video ended at {frame_index}')
            pos_row = pos_rows[frame_index]
            selected_id = pos_row.get('track_id') if pos_row.get('state') == 'candidate' else None
            for obj in player_rows.get(frame_index, {}).get('objects', []):
                x1,y1,x2,y2=[int(round(v)) for v in obj['bbox_xyxy']]
                team=obj.get('team') or 'unknown'
                color=(70,170,70) if team=='Ferro' else (180,90,40) if team=='Lujan' else (150,150,150)
                thickness=1
                if selected_id is not None and int(obj['track_id']) == int(selected_id):
                    color=(0,255,0); thickness=3
                cv2.rectangle(frame,(x1,y1),(x2,y2),color,thickness)
                cv2.putText(frame,f"#{obj['track_id']} {team}",(x1,max(15,y1-4)),cv2.FONT_HERSHEY_SIMPLEX,.38,color,1,cv2.LINE_AA)
            observation = ball_rows[frame_index].get('observation')
            if observation is not None:
                x1,y1,x2,y2=observation['bbox_xyxy']
                bx,by=int(round((x1+x2)/2)),int(round((y1+y2)/2))
                trail.append((frame_index,bx,by))
                cv2.circle(frame,(bx,by),9,(0,255,255),3)
            else:
                trail.clear()
            if frame_index in flight_by_frame:
                pts=[(x,y) for f,x,y in trail if f >= flight_by_frame[frame_index][1].start_frame]
                for p1,p2 in zip(pts,pts[1:]): cv2.line(frame,p1,p2,(0,165,255),2)
            if frame_index in event_by_frame:
                active_event=event_by_frame[frame_index]; event_until=frame_index+14
            cv2.rectangle(frame,(8,8),(740,90),(20,20,20),-1)
            cv2.putText(frame,'7Metros | integrated real-match analysis demo',(18,29),cv2.FONT_HERSHEY_SIMPLEX,.55,(255,255,255),1,cv2.LINE_AA)
            if observation is None:
                line1='BALL: unknown'
            elif frame_index in flight_by_frame:
                idx,flight=flight_by_frame[frame_index]
                line1=f"BALL FLIGHT? #{idx} {flight.mean_speed_px_per_frame:.1f}px/fr"
            else:
                line1='BALL: observed'
            state=pos_row.get('state')
            if state=='candidate':
                line2=f"POS? #{pos_row['track_id']} {pos_row.get('team') or 'unknown'}"
            elif state=='observed_ambiguous': line2='POS?: ambiguous'
            elif state=='observed_unassigned': line2='POS?: free/unassigned'
            else: line2='POS?: unknown (ball unobserved)'
            cv2.putText(frame,line1,(18,53),cv2.FONT_HERSHEY_SIMPLEX,.48,(0,255,255) if observation else (170,170,170),1,cv2.LINE_AA)
            cv2.putText(frame,line2,(250,53),cv2.FONT_HERSHEY_SIMPLEX,.48,(0,255,0) if state=='candidate' else (180,180,180),1,cv2.LINE_AA)
            if active_event is not None and frame_index <= event_until:
                event_text=f"CONTROL CHANGE? #{active_event.source_track_id} {active_event.source_team or '?'} -> #{active_event.target_track_id} {active_event.target_team or '?'}"
                cv2.putText(frame,event_text,(18,78),cv2.FONT_HERSHEY_SIMPLEX,.50,(0,165,255),1,cv2.LINE_AA)
            else:
                cv2.putText(frame,'EVENT: none confirmed',(18,78),cv2.FONT_HERSHEY_SIMPLEX,.47,(150,150,150),1,cv2.LINE_AA)
            writer.write(frame)
    finally:
        cap.release(); writer.release()
    states=Counter(r.get('state') for r in pos)
    payload={
        'status':'INTEGRATED_UNVERIFIED_HANDBALL_ANALYSIS_DEMO',
        'frames':frames,'start_frame':start_frame,
        'ball_observed_frames':sum(r.get('observation') is not None for r in balls),
        'possession_states':dict(states),
        'stable_possession_candidate_runs':len(stable_runs),
        'control_change_candidates':[asdict(e) for e in events],
        'free_ball_flight_candidates':[asdict(f) for f in flights],
        'confirmed_events':0,'accuracy_metrics':None,
    }
    output_json.write_text(json.dumps(payload,indent=2)+'\n',encoding='utf-8')
    return payload


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video',required=True); parser.add_argument('--player-tracks',required=True)
    parser.add_argument('--ball-observations',required=True); parser.add_argument('--possession-candidates',required=True)
    parser.add_argument('--output-video',required=True); parser.add_argument('--output-json',required=True)
    parser.add_argument('--start-frame',type=int,default=105); parser.add_argument('--frames',type=int,default=105)
    parser.add_argument('--min-stable-run-frames',type=int,default=2); parser.add_argument('--max-transition-gap-frames',type=int,default=4)
    parser.add_argument('--min-flight-frames',type=int,default=3); parser.add_argument('--min-flight-speed',type=float,default=8.0)
    parser.add_argument('--min-flight-linearity',type=float,default=.70)
    args=parser.parse_args(); print(json.dumps(run(**vars(args)),indent=2))


if __name__=='__main__': main()

"""Render synchronized A/B tracks on original frames with one H264 encode."""
import argparse
import json
from pathlib import Path
import subprocess

from sevenmetros_ai.tracking import Detection, Track
from sevenmetros_ai.visualization import draw_tracks


def load_window(path, start, end):
    rows={}
    with open(path) as f:
        for line in f:
            row=json.loads(line)
            if start<=row['frame_index']<end:rows[row['frame_index']]=row
    return rows


def render(video, before, after, output, start=3, seconds=5, slowdown=2):
    import cv2
    import numpy as np
    if start<0 or seconds<=0 or slowdown<=0:raise ValueError('Invalid time range')
    if Path(output).resolve() in {Path(p).resolve() for p in (video,before,after)}:
        raise ValueError('Output must differ from inputs')
    cap=cv2.VideoCapture(str(video));proc=None
    try:
        fps=cap.get(cv2.CAP_PROP_FPS)
        w,h=(int(cap.get(p)) for p in (cv2.CAP_PROP_FRAME_WIDTH,cv2.CAP_PROP_FRAME_HEIGHT))
        if not cap.isOpened() or fps<=0 or w<=0 or h<=0:raise ValueError('Invalid input')
        first,last=int(start*fps),int((start+seconds)*fps)
        a,b=load_window(before,first,last),load_window(after,first,last)
        cap.set(cv2.CAP_PROP_POS_FRAMES,first)
        proc=subprocess.Popen(['ffmpeg','-v','error','-n','-f','rawvideo','-pix_fmt','bgr24',
            '-s',f'{2*w}x{h+40}','-r',str(fps/slowdown),'-i','-','-an','-c:v','libx264',
            '-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(output)],stdin=subprocess.PIPE)
        for index in range(first,last):
            ok,frame=cap.read()
            if not ok:raise ValueError('Video truncated')
            panels=[]
            for rows,title in [(a,'ANTES: memoria 8 frames'),(b,'EXPERIMENTO: memoria 30 frames')]:
                row=rows[index]
                if row['image']!={'width':w,'height':h}:raise ValueError('Dimension mismatch')
                if abs(row['timestamp_ms']-index*1000/fps)>1:raise ValueError('Timestamp mismatch')
                tracks=[Track(o['track_id'],Detection(*o['bbox_xyxy'],confidence=o['confidence'],
                         label=o['kind'],team=o['team'],role_candidate=o.get('role_candidate'))) for o in row['objects']]
                panel=np.zeros((h+40,w,3),np.uint8)
                panel[40:]=draw_tracks(frame.copy(),tracks)
                cv2.putText(panel,f'{title} | t={index/fps:.2f}s',(10,27),0,.65,(255,255,255),1)
                panels.append(panel)
            proc.stdin.write(np.concatenate(panels,axis=1).tobytes())
        proc.stdin.close()
        if proc.wait()!=0:raise RuntimeError('FFmpeg failed')
        return last-first
    finally:
        cap.release()
        if proc and proc.poll() is None:proc.kill();proc.wait()


if __name__=='__main__':
    p=argparse.ArgumentParser()
    for name in ['video','before','after','output']:p.add_argument('--'+name,required=True)
    p.add_argument('--start',type=float,default=3);p.add_argument('--seconds',type=float,default=5)
    p.add_argument('--slowdown',type=float,default=2)
    print(json.dumps({'frames_rendered':render(**vars(p.parse_args()))}))

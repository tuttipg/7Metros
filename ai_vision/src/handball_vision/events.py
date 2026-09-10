from __future__ import annotations
import numpy as np
from .models import Event

class EventEngine:
    """Conservative handball event proposals. Outputs candidates, not ground-truth claims."""
    def __init__(self,fps=25.0,possession_radius=1.35,pass_window=30,shot_speed=7.0):
        self.fps=fps;self.possession_radius=possession_radius;self.pass_window=pass_window;self.shot_speed=shot_speed;self.owner=None;self.owner_team=None;self.owner_frame=None;self.last_ball=None;self.active_shot=None;self.events=[];self.shot_cooldown_until=-1
    def _nearest_owner(self,ball_xy,players):
        if ball_xy is None:return None,None,None
        best=None
        for p in players:
            pos=np.asarray(p['court_xy'],dtype=float);dist=float(np.linalg.norm(pos-ball_xy))
            if dist<=self.possession_radius and (best is None or dist<best[0]):best=(dist,p)
        if best is None:return None,None,None
        p=best[1];return p.get('player_id') or p.get('track_id'),p.get('team_id'),best[0]
    def update(self,frame,ball_xy,players):
        ball=None if ball_xy is None else np.asarray(ball_xy,dtype=float);speed=0.0
        if ball is not None and self.last_ball is not None:speed=float(np.linalg.norm(ball-self.last_ball)*self.fps)
        new_owner,new_team,dist=self._nearest_owner(ball,players)
        if new_owner is not None and self.owner is not None and new_owner!=self.owner:
            dt=frame-(self.owner_frame or frame)
            if dt<=self.pass_window:
                typ='pass' if new_team==self.owner_team else 'turnover';self.events.append(Event(typ,frame,.82,new_team,new_owner,self.owner,{'distance_to_ball':dist}))
            self.active_shot=None
        if self.owner is not None and new_owner is None and ball is not None and speed>=self.shot_speed and self.last_ball is not None:
            direction=float(ball[0]-self.last_ball[0]);toward_goal=(direction>0 and ball[0]>20) or (direction<0 and ball[0]<20)
            if toward_goal and self.active_shot is None and frame>self.shot_cooldown_until:
                self.active_shot={'frame':frame,'team_id':self.owner_team,'player_id':self.owner,'direction':np.sign(direction)};self.events.append(Event('shot_candidate',frame,.70,self.owner_team,self.owner,metadata={'speed_mps':speed}))
        if self.active_shot and ball is not None:
            at_goal=(ball[0]>=39.75 or ball[0]<=.25) and 8.5<=ball[1]<=11.5
            if at_goal and frame-self.active_shot['frame']<=int(self.fps*2.5):
                self.events.append(Event('goal_candidate',frame,.90,self.active_shot['team_id'],self.active_shot['player_id'],metadata={'ball_xy':ball.tolist()}));self.active_shot=None;self.owner=None;self.owner_team=None;self.owner_frame=None;self.shot_cooldown_until=frame+int(self.fps)
        if new_owner is not None:
            if new_owner!=self.owner:self.owner_frame=frame
            self.owner=new_owner;self.owner_team=new_team
        self.last_ball=ball;return list(self.events)

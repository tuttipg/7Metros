from __future__ import annotations
import numpy as np
from .models import Detection, BallState

class BallTracker:
    """Trajectory-first tracker for a tiny, fast and intermittently occluded ball."""
    def __init__(self,max_gap=8,base_gate=48.0,gate_growth=10.0,velocity_smoothing=0.62,position_gain=0.86):
        self.max_gap=max_gap;self.base_gate=base_gate;self.gate_growth=gate_growth;self.velocity_smoothing=velocity_smoothing;self.position_gain=position_gain;self.state=None
    def _candidate_score(self,pred,det,gate,dt):
        dist=float(np.linalg.norm(det.center-pred));motion=dist/max(gate,1e-6);size=float(det.metadata.get('radius',4.0));size_penalty=min(abs(size-5.0)/12.0,1.0)
        instant=(det.center-self.state.position)/max(dt,1);accel_raw=float(np.linalg.norm(instant-self.state.velocity));accel_limit=18.0+8.0*self.state.gap
        if accel_raw>accel_limit:return 99.0
        accel=min(accel_raw/25.0,2.0)
        return .62*motion+.28*accel+.06*(1.0-det.confidence)+.04*size_penalty
    def update(self,frame:int,detections:list[Detection]):
        balls=[d for d in detections if d.class_name=='ball' and d.confidence>=.05]
        if self.state is None:
            if not balls:return None
            d=max(balls,key=lambda x:x.confidence);self.state=BallState(frame,d.center.copy(),np.zeros(2),d.confidence,True,0);return self.state
        dt=max(frame-self.state.frame,1);pred=self.state.position+self.state.velocity*dt;gate=self.base_gate+self.gate_growth*self.state.gap;valid=[]
        for d in balls:
            if float(np.linalg.norm(d.center-pred))<=gate:valid.append((self._candidate_score(pred,d,gate,dt),d))
        valid=[z for z in valid if z[0]<10.0]
        if valid:
            _,d=min(valid,key=lambda z:z[0]);measured=d.center;instant=(measured-self.state.position)/dt;vel=self.velocity_smoothing*self.state.velocity+(1-self.velocity_smoothing)*instant;pos=self.position_gain*measured+(1-self.position_gain)*pred;self.state=BallState(frame,pos,vel,d.confidence,True,0)
        else:
            gap=self.state.gap+1
            if gap>self.max_gap:self.state=None;return None
            self.state=BallState(frame,pred,self.state.velocity.copy(),self.state.confidence*(.78**gap),False,gap)
        return self.state

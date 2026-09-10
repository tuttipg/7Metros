from __future__ import annotations
import numpy as np
from scipy.optimize import linear_sum_assignment
from .models import Detection, PlayerTrack
from .geometry import expanded_iou, cosine_distance, translate_bbox

class IdentityFirstTracker:
    """Sports MOT tracker optimized to avoid ID switches over maximizing frame coverage."""
    def __init__(self, high_conf=0.55, low_conf=0.12, max_age=18, min_hits=2,
                 max_center_distance=140.0, match_threshold=1.20,
                 w_iou=0.30, w_motion=0.25, w_appearance=0.38, w_identity=0.07):
        self.high_conf=high_conf; self.low_conf=low_conf; self.max_age=max_age; self.min_hits=min_hits
        self.max_center_distance=max_center_distance; self.match_threshold=match_threshold
        self.w_iou=w_iou; self.w_motion=w_motion; self.w_appearance=w_appearance; self.w_identity=w_identity
        self.tracks=[]; self.next_id=1

    def _predict_bbox(self, t): return translate_bbox(t.bbox, t.velocity)
    def _cost(self, t, d):
        pred=self._predict_bbox(t); iou_cost=1.0-expanded_iou(pred,d.bbox,1.40)
        pc=np.array([(pred[0]+pred[2])/2,(pred[1]+pred[3])/2],dtype=float)
        motion=min(float(np.linalg.norm(pc-d.center))/self.max_center_distance,2.0)
        appearance=cosine_distance(t.embedding,d.embedding)
        if t.team_id is not None and d.team_id is not None and t.team_id != d.team_id: return 99.0
        if (t.team_id is not None and d.team_id is not None and t.team_id == d.team_id and t.jersey_number is not None and d.jersey_number is not None and t.jersey_number != d.jersey_number): return 99.0
        return self.w_iou*iou_cost+self.w_motion*motion+self.w_appearance*appearance
    def _associate(self, track_indices, detections):
        if not track_indices or not detections:return [],track_indices,list(range(len(detections)))
        C=np.array([[self._cost(self.tracks[i],d) for d in detections] for i in track_indices],dtype=float);rows,cols=linear_sum_assignment(C)
        matches=[];used_t=set();used_d=set()
        for r,c in zip(rows,cols):
            if C[r,c] <= self.match_threshold:
                margins=np.sort(C[:,c]);margin=float(margins[1]-margins[0]) if len(margins)>1 else 1.0;uncertainty=float(np.clip(1.0-margin,0.0,1.0))
                matches.append((track_indices[r],c,uncertainty));used_t.add(track_indices[r]);used_d.add(c)
        return matches,[i for i in track_indices if i not in used_t],[j for j in range(len(detections)) if j not in used_d]
    def _update_track(self,t,d,uncertainty):
        old=t.center.copy();new=d.center;instant=new-old;t.velocity=.70*t.velocity+.30*instant
        t.bbox=d.bbox;t.confidence=d.confidence;t.hits+=1;t.missed=0;t.matched=True;t.uncertainty=uncertainty
        if d.embedding is not None:
            emb=np.asarray(d.embedding,dtype=float)
            if t.embedding is None:t.embedding=emb.copy()
            else:
                merged=.82*t.embedding+.18*emb;n=np.linalg.norm(merged);t.embedding=merged/max(n,1e-9)
        for attr in ('team_id','jersey_number','player_id'):
            val=getattr(d,attr)
            if val is not None:setattr(t,attr,val)
    def _new_track(self,d):
        t=PlayerTrack(self.next_id,d.bbox,d.confidence,d.team_id,d.jersey_number,d.player_id,None if d.embedding is None else np.asarray(d.embedding,dtype=float).copy());self.next_id+=1;self.tracks.append(t)
    def update(self,detections:list[Detection])->list[PlayerTrack]:
        for t in self.tracks:t.age+=1;t.missed+=1;t.matched=False;t.bbox=self._predict_bbox(t)
        player_dets=[d for d in detections if d.class_name in {'player','goalkeeper'} and d.confidence>=self.low_conf]
        hi=[d for d in player_dets if d.confidence>=self.high_conf];lo=[d for d in player_dets if self.low_conf<=d.confidence<self.high_conf]
        matches,unmatched,_=self._associate(list(range(len(self.tracks))),hi);matched_hi={di for _,di,_ in matches}
        for ti,di,u in matches:self._update_track(self.tracks[ti],hi[di],u)
        low_matches,_,_=self._associate(unmatched,lo)
        for ti,di,u in low_matches:self._update_track(self.tracks[ti],lo[di],u)
        for di,d in enumerate(hi):
            if di not in matched_hi:self._new_track(d)
        self.tracks=[t for t in self.tracks if t.missed<=self.max_age]
        return [t for t in self.tracks if t.matched and t.hits>=self.min_hits]

from __future__ import annotations
import numpy as np
import cv2

class TeamColorClassifier:
    def __init__(self): self.centroids=None
    @staticmethod
    def feature(crop):
        if crop is None or crop.size==0: return np.zeros(3)
        hsv=cv2.cvtColor(crop,cv2.COLOR_BGR2HSV); h,w=hsv.shape[:2]
        roi=hsv[max(0,int(h*.12)):max(1,int(h*.72)),max(0,int(w*.18)):max(1,int(w*.82))]
        return np.median(roi.reshape(-1,3),axis=0).astype(float)
    def fit(self,features,iterations=25):
        X=np.asarray(features,dtype=float)
        if len(X)<2: raise ValueError('Need at least two samples')
        D=((X[:,None,:]-X[None,:,:])**2).sum(2);i,j=np.unravel_index(np.argmax(D),D.shape);C=np.stack([X[i],X[j]])
        for _ in range(iterations):
            labels=((X[:,None,:]-C[None,:,:])**2).sum(2).argmin(1);new=np.stack([X[labels==k].mean(0) if np.any(labels==k) else C[k] for k in range(2)])
            if np.allclose(new,C):break
            C=new
        self.centroids=C;return labels
    def predict(self,feature):
        if self.centroids is None:raise RuntimeError('Classifier not fitted')
        f=np.asarray(feature,dtype=float);d=((self.centroids-f)**2).sum(1);idx=int(np.argmin(d));margin=float(abs(d[1]-d[0])/(d.sum()+1e-9));return idx,margin

class RosterIdentityResolver:
    """Resolves team + shirt number against 7Metros roster/participation data."""
    def __init__(self,rows):
        self.map={}
        for r in rows:
            team=r.get('equipo_id') if isinstance(r,dict) else getattr(r,'equipo_id',None);jersey=r.get('dorsal') if isinstance(r,dict) else getattr(r,'dorsal',None);player=r.get('jugador_id') if isinstance(r,dict) else getattr(r,'jugador_id',None)
            if team is not None and jersey is not None and player is not None:self.map[(int(team),int(jersey))]=int(player)
    def resolve(self,team_id,jersey_number):
        if team_id is None or jersey_number is None:return None
        return self.map.get((int(team_id),int(jersey_number)))

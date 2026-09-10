from __future__ import annotations
import numpy as np
import cv2

def bbox_iou(a, b) -> float:
    ax1, ay1, ax2, ay2 = a; bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1,bx1), max(ay1,by1)
    ix2, iy2 = min(ax2,bx2), min(ay2,by2)
    iw, ih = max(0.0, ix2-ix1), max(0.0, iy2-iy1)
    inter = iw*ih
    aa = max(0.0, ax2-ax1)*max(0.0, ay2-ay1)
    ba = max(0.0, bx2-bx1)*max(0.0, by2-by1)
    return inter / max(aa+ba-inter, 1e-9)

def expanded_iou(a, b, scale=1.35) -> float:
    def expand(box):
        x1,y1,x2,y2=box; cx=(x1+x2)/2; cy=(y1+y2)/2; w=(x2-x1)*scale; h=(y2-y1)*scale
        return (cx-w/2, cy-h/2, cx+w/2, cy+h/2)
    return bbox_iou(expand(a), expand(b))

def cosine_distance(a, b) -> float:
    if a is None or b is None: return 0.5
    a=np.asarray(a,dtype=float); b=np.asarray(b,dtype=float)
    na=np.linalg.norm(a); nb=np.linalg.norm(b)
    if na < 1e-9 or nb < 1e-9: return 0.5
    return float(1.0 - np.clip(np.dot(a,b)/(na*nb), -1.0, 1.0))

def translate_bbox(box, delta):
    x1,y1,x2,y2=box; dx,dy=float(delta[0]),float(delta[1])
    return (x1+dx,y1+dy,x2+dx,y2+dy)

class CourtProjector:
    """Perspective mapping image pixels -> standard 40x20 m handball court."""
    def __init__(self, image_points, court_points=None):
        self.image_points=np.asarray(image_points,dtype=np.float32)
        if court_points is None:
            court_points=np.array([[0,0],[40,0],[40,20],[0,20]],dtype=np.float32)
        self.court_points=np.asarray(court_points,dtype=np.float32)
        if len(self.image_points) < 4 or len(self.court_points) < 4:
            raise ValueError("At least four point correspondences are required")
        self.H, self.mask=cv2.findHomography(self.image_points,self.court_points,cv2.RANSAC,3.0)
        if self.H is None: raise ValueError("Homography could not be estimated")
    def project(self, points):
        pts=np.asarray(points,dtype=np.float32).reshape(-1,1,2)
        return cv2.perspectiveTransform(pts,self.H).reshape(-1,2)

"""Opt-in heuristic for this blue-floor fixture; not a general court model."""
from dataclasses import replace
from .tracking import bbox_iou
from .teams import representative_jersey_rgb, classify_rgb


def suppress_duplicates(detections, threshold=.55):
    kept = []
    for d in sorted(detections, key=lambda d: -d.confidence):
        if not any(d.label == k.label and bbox_iou(d, k) > threshold for k in kept):
            kept.append(d)
    return kept


class BlueCourtClassifier:
    def classify(self, frame, detections):
        import cv2
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, (85, 60, 95), (120, 255, 255))
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return []  # no court evidence: fail closed
        contour = max(contours, key=cv2.contourArea)
        if cv2.contourArea(contour) < frame.shape[0]*frame.shape[1]*.15:
            return []
        hull = cv2.convexHull(contour)
        result = []
        refs = {'team_a': (150, 173, 225), 'team_b': (55, 62, 130)}
        for d in suppress_duplicates(detections):
            if cv2.pointPolygonTest(hull, (float(d.cx), float(min(d.y2, frame.shape[0]-1))), True) < -8:
                continue
            rgb = representative_jersey_rgb(frame, d)
            team = None
            if rgb and max(rgb) >= 80 and d.label == 'player':
                team = classify_rgb(rgb, refs, max_distance=.10, min_margin=.025)
                # White fabric has a strong blue cast under these lights.
                # Brightness is an explicit fixture-specific correction, not ReID.
                if sum(rgb)/3 > 130 and rgb[0] > 95 and rgb[1] > 100:
                    team = 'team_a'
            result.append(replace(d, team=team))
        return result

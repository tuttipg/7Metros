"""Opt-in heuristics for this blue-floor fixture; not a general court model."""
from dataclasses import replace
from math import isfinite
from .tracking import bbox_iou
from .teams import representative_jersey_rgb, classify_rgb


def suppress_duplicates(detections, threshold=.55):
    kept = []
    for d in sorted(detections, key=lambda d: -d.confidence):
        if not any(d.label == k.label and bbox_iou(d, k) > threshold for k in kept):
            kept.append(d)
    return kept


def _largest_blue_court_contour(frame):
    import cv2
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, (85, 60, 95), (120, 255, 255))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None, 0.0
    contour = max(contours, key=cv2.contourArea)
    pixels = int(frame.shape[0]) * int(frame.shape[1])
    if pixels <= 0:
        raise ValueError("frame must have positive width and height")
    return contour, float(cv2.contourArea(contour)) / pixels


def blue_court_fraction(frame):
    """Return the largest connected blue-court contour as a frame fraction."""
    return _largest_blue_court_contour(frame)[1]


def blue_court_present(frame, *, min_fraction=.15):
    """Apply the fixture's existing fail-closed court-presence criterion."""
    threshold = float(min_fraction)
    if not isfinite(threshold) or not 0 < threshold <= 1:
        raise ValueError("min_fraction must be in (0,1]")
    return blue_court_fraction(frame) >= threshold


class BlueCourtClassifier:
    def classify(self, frame, detections):
        import cv2
        contour, fraction = _largest_blue_court_contour(frame)
        if contour is None:
            return []  # no court evidence: fail closed
        if fraction < .15:
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

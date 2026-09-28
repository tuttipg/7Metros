"""Fixture-only kit heuristics, recovered from the recorded iteration.

User confirmed white/green Ferro, blue/white Lujan, purple/pink keepers,
black referees. Role hints are never confirmed roles or hard tracker classes.
"""
from dataclasses import replace
from .fixture_filter import BlueCourtClassifier
from .teams import representative_jersey_rgb, classify_rgb


def classify_kit(rgb):
    if rgb is None:
        return None, None
    r, g, b = rgb
    if max(rgb) < 80:
        if r > g * 1.25 and b > g * 1.6 and r > 35:
            return None, 'Ferro_GK'
        return None, 'referee'
    if r > g * 1.6 and r > b * 1.1:
        return None, 'Lujan_GK'
    if r > g * 1.25 and b > g * 1.6:
        return None, 'Ferro_GK'
    if sum(rgb) / 3 > 130 and r > 95 and g > 100:
        return 'Ferro', None
    if b > 2.8 * max(g, 1):
        return None, None
    return classify_rgb(rgb, {'Lujan': (55, 62, 130)}, max_distance=.07), None


class FerroLujanKits(BlueCourtClassifier):
    def __init__(self, *, allow_boundary_roles=False):
        self.allow_boundary_roles = bool(allow_boundary_roles)

    def classify(self, frame, detections):
        result = []
        for d in super().classify(frame, detections):
            if d.label != 'player':
                result.append(d)
                continue
            team, role = classify_kit(representative_jersey_rgb(frame, d))
            if (not self.allow_boundary_roles and role == 'referee'
                    and (d.y2 >= frame.shape[0]-3 or d.x1 <= 0
                         or d.x2 >= frame.shape[1]-1)):
                role = None
            result.append(replace(d, team=team, role_candidate=role))
        return result

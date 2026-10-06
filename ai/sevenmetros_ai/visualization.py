from __future__ import annotations

from typing import Iterable

from .tracking import Track


def track_label(track: Track) -> str:
    det = track.detection
    if det.role_candidate:
        role = {'Ferro_GK': 'Arq.Ferro?', 'Lujan_GK': 'Arq.Lujan?', 'referee': 'Arbitro?'}.get(det.role_candidate, det.role_candidate+'?')
        return f'{role} #{track.track_id} {float(det.confidence):.2f}'
    label = f"{det.label} #{track.track_id} {float(det.confidence):.2f}"
    if det.team:
        label += f" [{det.team}]"
    return label


def draw_tracks(frame, tracks: Iterable[Track]):
    """Draw bounding boxes and persistent IDs on a frame in-place.

    OpenCV is imported lazily so the core package remains usable without the
    optional vision dependencies installed.
    """
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError("OpenCV is not installed. Install the optional 'vision' dependencies.") from exc

    for track in tracks:
        det = track.detection
        x1, y1, x2, y2 = (int(round(det.x1)), int(round(det.y1)), int(round(det.x2)), int(round(det.y2)))
        color = {'team_a': (0, 220, 255), 'team_b': (255, 80, 180), 'Ferro': (245,245,245), 'Lujan': (255,170,30)}.get(det.team, (0, 255, 0))
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        text = track_label(track)
        text_y = max(16, y1 - 6)
        cv2.putText(frame, text, (x1, text_y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)
    return frame

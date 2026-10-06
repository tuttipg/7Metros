"""Detect persistent score-glyph changes in the fixed Ferro-Lujan broadcast overlay."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from sevenmetros_ai.scoreboard import PersistentScoreGlyphDetector


def _signature(frame, roi, threshold=140):
    try:
        import cv2
    except ImportError as exc:  # pragma: no cover - optional vision runtime
        raise RuntimeError("OpenCV is required") from exc
    x1, y1, x2, y2 = roi
    gray = cv2.cvtColor(frame[y1:y2, x1:x2], cv2.COLOR_BGR2GRAY)
    return tuple(int(value) for value in (gray < int(threshold)).reshape(-1))


def benchmark(
    video,
    *,
    source_offset=900,
    frames=3600,
    top_roi=(176, 36, 191, 58),
    bottom_roi=(176, 71, 191, 90),
    threshold=140,
    change_fraction=.05,
    same_state_fraction=.02,
    stable_frames=5,
    initial_stable_frames=30,
):
    try:
        import cv2
    except ImportError as exc:  # pragma: no cover - optional vision runtime
        raise RuntimeError("OpenCV is required") from exc
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {video}")
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(source_offset))
    detectors = {
        "Ferro": PersistentScoreGlyphDetector(
            "top", change_fraction=change_fraction,
            same_state_fraction=same_state_fraction,
            stable_frames=stable_frames,
            initial_stable_frames=initial_stable_frames,
        ),
        "Lujan": PersistentScoreGlyphDetector(
            "bottom", change_fraction=change_fraction,
            same_state_fraction=same_state_fraction,
            stable_frames=stable_frames,
            initial_stable_frames=initial_stable_frames,
        ),
    }
    rois = {"Ferro": top_roi, "Lujan": bottom_roi}
    events = []
    try:
        for fixture_frame in range(int(frames)):
            ok, frame = cap.read()
            if not ok:
                raise RuntimeError(f"Video ended at fixture frame {fixture_frame}")
            for team, detector in detectors.items():
                event = detector.update(
                    fixture_frame, _signature(frame, rois[team], threshold)
                )
                if event is not None:
                    events.append({
                        "team": team,
                        "side": event.side,
                        "scoreboard_change_frame": event.frame_index,
                        "confirmation_frame": event.confirmation_frame,
                        "changed_fraction": event.changed_fraction,
                        "stable_frames": event.stable_frames,
                    })
    finally:
        cap.release()
    return {
        "frames": int(frames),
        "source_offset": int(source_offset),
        "events": events,
        "settings": {
            "threshold": int(threshold),
            "change_fraction": float(change_fraction),
            "same_state_fraction": float(same_state_fraction),
            "stable_frames": int(stable_frames),
            "initial_stable_frames": int(initial_stable_frames),
            "top_roi": list(top_roi),
            "bottom_roi": list(bottom_roi),
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    result = benchmark(args.video)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

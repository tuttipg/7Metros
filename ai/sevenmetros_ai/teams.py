from __future__ import annotations

from dataclasses import replace
from math import sqrt
from typing import Iterable, Mapping

from .tracking import Detection


RGB = tuple[float, float, float]


def _chromaticity(rgb: RGB) -> RGB:
    """Normalize RGB so brightness changes have less impact on matching."""
    values = tuple(max(0.0, float(value)) for value in rgb)
    total = sum(values)
    if total <= 1e-9:
        return (0.0, 0.0, 0.0)
    return tuple(value / total for value in values)  # type: ignore[return-value]


def chromatic_distance(left: RGB, right: RGB) -> float:
    """Euclidean distance between brightness-normalized RGB colors."""
    a = _chromaticity(left)
    b = _chromaticity(right)
    return sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def classify_rgb(
    sample: RGB,
    references: Mapping[str, RGB],
    *,
    max_distance: float = 0.22,
    min_margin: float = 0.025,
) -> str | None:
    """Classify a representative jersey color against known team references.

    The result is conservative by design: ambiguous or distant samples remain
    unknown instead of forcing a team label that could later corrupt tracking.
    """
    if not references:
        return None
    if max_distance <= 0:
        raise ValueError("max_distance must be > 0")
    if min_margin < 0:
        raise ValueError("min_margin must be >= 0")

    ranked = sorted(
        (chromatic_distance(sample, rgb), str(team))
        for team, rgb in references.items()
    )
    best_distance, best_team = ranked[0]
    if best_distance > max_distance:
        return None
    if len(ranked) > 1 and ranked[1][0] - best_distance < min_margin:
        return None
    return best_team


def representative_jersey_rgb(frame, detection: Detection) -> RGB | None:
    """Estimate jersey color from the central upper-body region of a player box.

    NumPy is imported lazily so the dependency-free tracking/tests continue to
    work without the optional vision stack.
    """
    try:
        import numpy as np
    except ImportError as exc:  # pragma: no cover - exercised only without vision extras
        raise RuntimeError("NumPy is required for jersey-color classification.") from exc

    height, width = frame.shape[:2]
    x1 = max(0, min(width, int(round(detection.x1))))
    x2 = max(0, min(width, int(round(detection.x2))))
    y1 = max(0, min(height, int(round(detection.y1))))
    y2 = max(0, min(height, int(round(detection.y2))))
    if x2 <= x1 or y2 <= y1:
        return None

    box_w = x2 - x1
    box_h = y2 - y1
    # Focus on torso: discard box edges/background plus head and lower legs.
    tx1 = x1 + int(box_w * 0.20)
    tx2 = x2 - int(box_w * 0.20)
    ty1 = y1 + int(box_h * 0.20)
    ty2 = y1 + int(box_h * 0.62)
    crop = frame[ty1:ty2, tx1:tx2]
    if crop.size == 0:
        return None

    pixels = crop.reshape(-1, crop.shape[-1])
    if pixels.shape[1] < 3:
        return None
    # OpenCV frames are BGR; use channel-wise median for robustness to small
    # logos, skin, highlights and compression artifacts.
    bgr = np.median(pixels[:, :3], axis=0)
    return (float(bgr[2]), float(bgr[1]), float(bgr[0]))


class JerseyColorTeamClassifier:
    """Attach conservative team labels to player detections using jersey color."""

    def __init__(
        self,
        references: Mapping[str, RGB],
        *,
        max_distance: float = 0.22,
        min_margin: float = 0.025,
    ) -> None:
        self.references = dict(references)
        self.max_distance = float(max_distance)
        self.min_margin = float(min_margin)

    def classify(self, frame, detections: Iterable[Detection]) -> list[Detection]:
        output: list[Detection] = []
        for detection in detections:
            if detection.label != "player" or detection.team is not None:
                output.append(detection)
                continue
            rgb = representative_jersey_rgb(frame, detection)
            team = None if rgb is None else classify_rgb(
                rgb,
                self.references,
                max_distance=self.max_distance,
                min_margin=self.min_margin,
            )
            output.append(replace(detection, team=team))
        return output

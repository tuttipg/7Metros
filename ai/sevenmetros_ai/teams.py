from __future__ import annotations

from dataclasses import replace
from math import sqrt
from typing import Iterable, Mapping, Sequence

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


def _mean_rgb(values: Sequence[RGB]) -> RGB:
    if not values:
        raise ValueError("cannot average an empty color cluster")
    count = float(len(values))
    return tuple(sum(color[channel] for color in values) / count for channel in range(3))  # type: ignore[return-value]


def fit_team_color_references(
    samples: Iterable[RGB],
    *,
    team_names: tuple[str, str] = ("team_a", "team_b"),
    min_samples: int = 6,
    max_iterations: int = 32,
) -> dict[str, RGB]:
    """Fit two deterministic jersey-color references from unlabeled samples.

    This is a small, dependency-free two-cluster baseline intended for match-level
    calibration. Initialization uses the farthest chromatic pair, then Lloyd-style
    assignment/update iterations. Returned references preserve mean RGB brightness
    while assignment is performed in chromaticity space.

    The function deliberately refuses underdetermined/degenerate inputs instead of
    inventing two teams from effectively one color family.
    """
    values = [tuple(float(channel) for channel in sample) for sample in samples]
    if min_samples < 2:
        raise ValueError("min_samples must be >= 2")
    if len(values) < min_samples:
        raise ValueError(f"at least {min_samples} jersey samples are required")
    if len(team_names) != 2 or not all(str(name).strip() for name in team_names):
        raise ValueError("team_names must contain two non-empty labels")
    if team_names[0] == team_names[1]:
        raise ValueError("team_names must be distinct")
    if max_iterations <= 0:
        raise ValueError("max_iterations must be > 0")

    best_pair: tuple[int, int] | None = None
    best_distance = -1.0
    for i in range(len(values)):
        for j in range(i + 1, len(values)):
            distance = chromatic_distance(values[i], values[j])
            if distance > best_distance:
                best_distance = distance
                best_pair = (i, j)

    if best_pair is None or best_distance <= 1e-6:
        raise ValueError("jersey samples do not contain two separable color families")

    centers = [values[best_pair[0]], values[best_pair[1]]]
    assignments: list[int] | None = None

    for _ in range(max_iterations):
        next_assignments = [
            0 if chromatic_distance(sample, centers[0]) <= chromatic_distance(sample, centers[1]) else 1
            for sample in values
        ]
        clusters = [
            [sample for sample, cluster_id in zip(values, next_assignments) if cluster_id == 0],
            [sample for sample, cluster_id in zip(values, next_assignments) if cluster_id == 1],
        ]
        if not clusters[0] or not clusters[1]:
            raise ValueError("automatic calibration collapsed to one color cluster")

        new_centers = [_mean_rgb(clusters[0]), _mean_rgb(clusters[1])]
        if next_assignments == assignments:
            centers = new_centers
            break
        assignments = next_assignments
        centers = new_centers

    if chromatic_distance(centers[0], centers[1]) <= 0.03:
        raise ValueError("automatic calibration found jersey colors that are too similar")

    # Stable ordering makes repeated runs reproducible regardless of input order.
    centers.sort(key=lambda rgb: _chromaticity(rgb))
    return {str(team_names[0]): centers[0], str(team_names[1]): centers[1]}


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

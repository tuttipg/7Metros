from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import numpy as np

@dataclass
class Detection:
    bbox: tuple[float, float, float, float]
    confidence: float
    class_name: str = "player"
    embedding: Optional[np.ndarray] = None
    team_id: Optional[int] = None
    jersey_number: Optional[int] = None
    player_id: Optional[int] = None
    metadata: dict = field(default_factory=dict)

    @property
    def center(self) -> np.ndarray:
        x1, y1, x2, y2 = self.bbox
        return np.array([(x1+x2)/2.0, (y1+y2)/2.0], dtype=float)

@dataclass
class PlayerTrack:
    track_id: int
    bbox: tuple[float, float, float, float]
    confidence: float
    team_id: Optional[int] = None
    jersey_number: Optional[int] = None
    player_id: Optional[int] = None
    embedding: Optional[np.ndarray] = None
    age: int = 1
    hits: int = 1
    missed: int = 0
    velocity: np.ndarray = field(default_factory=lambda: np.zeros(2, dtype=float))
    matched: bool = True
    uncertainty: float = 0.0

    @property
    def center(self) -> np.ndarray:
        x1, y1, x2, y2 = self.bbox
        return np.array([(x1+x2)/2.0, (y1+y2)/2.0], dtype=float)

@dataclass
class BallState:
    frame: int
    position: np.ndarray
    velocity: np.ndarray
    confidence: float
    observed: bool
    gap: int = 0

@dataclass
class Event:
    event_type: str
    frame: int
    confidence: float
    team_id: Optional[int] = None
    player_id: Optional[int] = None
    related_player_id: Optional[int] = None
    metadata: dict = field(default_factory=dict)

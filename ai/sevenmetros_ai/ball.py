"""Conservative handball candidate detection using YOLO's COCO sports-ball class.

This is a detection baseline, not possession or event inference. Missing frames stay
missing: no interpolation or hallucinated ball positions are produced here.
"""
from __future__ import annotations

from .tracking import Detection


COCO_SPORTS_BALL_CLASS_ID = 32


class YoloSportsBallDetector:
    """Return raw sports-ball candidates as ``Detection(label='ball')`` objects."""

    def __init__(self, model="yolo11n.pt", confidence=0.05, imgsz=640, *, yolo_model=None):
        if not 0 < float(confidence) <= 1:
            raise ValueError("confidence must be in (0,1]")
        if int(imgsz) <= 0:
            raise ValueError("imgsz must be positive")
        self.confidence = float(confidence)
        self.imgsz = int(imgsz)
        if yolo_model is None:
            try:
                from ultralytics import YOLO
            except ImportError as exc:  # pragma: no cover - optional vision runtime
                raise RuntimeError("Ultralytics is required for ball detection") from exc
            yolo_model = YOLO(model)
        self.model = yolo_model

    def detect(self, frame):
        results = self.model.predict(
            frame,
            classes=[COCO_SPORTS_BALL_CLASS_ID],
            conf=self.confidence,
            imgsz=self.imgsz,
            verbose=False,
        )
        if not results:
            return []
        detections = []
        for box in results[0].boxes:
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
            confidence = float(box.conf[0])
            detections.append(Detection(
                x1=x1, y1=y1, x2=x2, y2=y2,
                confidence=confidence, label="ball",
            ))
        return detections

from __future__ import annotations

from .tracking import Detection


class UltralyticsPersonDetector:
    """Optional YOLO adapter loaded only when used."""

    def __init__(self, model: str = "yolo11n.pt", confidence: float = 0.25, device: str | None = None) -> None:
        try:
            from ultralytics import YOLO
        except ImportError as exc:
            raise RuntimeError("Ultralytics is not installed. Install the optional 'vision' dependencies.") from exc
        self.model_name = model
        self.confidence = float(confidence)
        self.device = device
        self._model = YOLO(model)

    def detect(self, frame) -> list[Detection]:
        kwargs = {"source": frame, "classes": [0], "conf": self.confidence, "verbose": False}
        if self.device:
            kwargs["device"] = self.device
        results = self._model.predict(**kwargs)
        detections: list[Detection] = []
        for result in results:
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue
            for box in boxes:
                xyxy = box.xyxy[0].tolist()
                confidence = float(box.conf[0]) if box.conf is not None else 1.0
                detections.append(Detection(x1=float(xyxy[0]), y1=float(xyxy[1]), x2=float(xyxy[2]), y2=float(xyxy[3]), confidence=confidence, label="player"))
        return detections

#!/usr/bin/env python3
"""Baseline de visión por computadora para 7Metros.

No contiene pesos entrenados. El objetivo es fijar un contrato reproducible para que
cualquier detector/tracker pueda compararse con el mismo formato de salida.

Salida JSONL por detección:
{"frame": 10, "timestamp_ms": 400, "class": "player", "confidence": .91,
 "track_id": "12", "bbox": [x1,y1,x2,y2], "team": null, "jersey": null}
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Iterable


@dataclass
class Detection:
    frame: int
    timestamp_ms: int
    class_name: str
    confidence: float
    bbox: list[float]
    track_id: str | None = None
    team: str | None = None
    jersey: str | None = None

    def to_event(self) -> dict[str, Any]:
        data = asdict(self)
        data["class"] = data.pop("class_name")
        return data


def iter_ultralytics(video: Path, weights: Path, confidence: float, device: str | None = None) -> Iterable[Detection]:
    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise RuntimeError("Falta ultralytics. Instalá requirements-ai.txt") from exc

    model = YOLO(str(weights))
    stream = model.track(
        source=str(video),
        stream=True,
        persist=True,
        conf=confidence,
        tracker="bytetrack.yaml",
        verbose=False,
        device=device,
    )
    for frame_index, result in enumerate(stream):
        fps = float(getattr(result, "speed", {}).get("fps", 0) or 0)
        # OpenCV/Ultralytics no siempre exponen timestamp; la aproximación usa FPS
        # del stream cuando existe y cae a 25 FPS solo como metadata temporal.
        timestamp_ms = int(frame_index * 1000 / (fps if fps > 0 else 25.0))
        names = getattr(result, "names", {}) or {}
        boxes = getattr(result, "boxes", None)
        if boxes is None:
            continue
        xyxy = boxes.xyxy.cpu().tolist() if boxes.xyxy is not None else []
        confs = boxes.conf.cpu().tolist() if boxes.conf is not None else []
        classes = boxes.cls.cpu().tolist() if boxes.cls is not None else []
        ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(xyxy)
        for bbox, score, class_id, track_id in zip(xyxy, confs, classes, ids):
            yield Detection(
                frame=frame_index,
                timestamp_ms=timestamp_ms,
                class_name=str(names.get(int(class_id), int(class_id))),
                confidence=float(score),
                bbox=[round(float(x), 2) for x in bbox],
                track_id=str(track_id) if track_id is not None else None,
            )


def write_jsonl(rows: Iterable[Detection], output: Path) -> dict[str, int]:
    output.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    tracks: set[str] = set()
    classes: dict[str, int] = {}
    with output.open("w", encoding="utf-8") as fh:
        for row in rows:
            event = row.to_event()
            fh.write(json.dumps(event, ensure_ascii=False) + "\n")
            count += 1
            if row.track_id:
                tracks.add(row.track_id)
            classes[row.class_name] = classes.get(row.class_name, 0) + 1
    return {"detections": count, "tracks": len(tracks), **{f"class_{k}": v for k, v in classes.items()}}


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="7Metros CV baseline")
    p.add_argument("video", type=Path)
    p.add_argument("--weights", type=Path, required=True, help="Pesos YOLO entrenados para handball")
    p.add_argument("--output", type=Path, default=Path("runs/events.jsonl"))
    p.add_argument("--confidence", type=float, default=0.25)
    p.add_argument("--device", default=None, help="cpu, 0, 0,1, mps…")
    return p


def main() -> int:
    args = parser().parse_args()
    if not args.video.exists():
        raise SystemExit(f"Video inexistente: {args.video}")
    if not args.weights.exists():
        raise SystemExit(f"Pesos inexistentes: {args.weights}")
    if not 0 < args.confidence <= 1:
        raise SystemExit("--confidence debe estar entre 0 y 1")
    stats = write_jsonl(iter_ultralytics(args.video, args.weights, args.confidence, args.device), args.output)
    print(json.dumps({"output": str(args.output), **stats}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

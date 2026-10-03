"""Run fresh sports-ball inference against evaluable human-reviewed frames."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from sevenmetros_ai.ball import YoloSportsBallDetector
from sevenmetros_ai.ball_ground_truth import (
    evaluate_ball_ground_truth,
    sha256_file,
    validate_ball_ground_truth,
)


def benchmark(video, model, ground_truth_paths, *, confidence=.05, imgsz=960):
    try:
        import cv2
    except ImportError as exc:  # pragma: no cover - optional vision runtime
        raise RuntimeError("OpenCV is required") from exc
    video, model = Path(video), Path(model)
    documents = []
    annotations = []
    for path in ground_truth_paths:
        document = json.loads(Path(path).read_text(encoding="utf-8"))
        validate_ball_ground_truth(document, source_video=video)
        documents.append(document)
        annotations.extend(document["annotations"])
    evaluable_frames = sorted(
        row["frame_index"] for row in annotations
        if row["state"] in {"visible", "out_of_frame"}
    )
    if len(evaluable_frames) != len(set(evaluable_frames)):
        raise ValueError("ground-truth documents contain duplicate evaluable frames")

    detector = YoloSportsBallDetector(model, confidence=confidence, imgsz=imgsz)
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {video}")
    predictions = {}
    try:
        for frame_index in evaluable_frames:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            ok, frame = cap.read()
            if not ok:
                raise RuntimeError(f"Video ended before frame {frame_index}")
            predictions[frame_index] = [{
                "confidence": float(item.confidence),
                "bbox_xyxy": [float(item.x1), float(item.y1), float(item.x2), float(item.y2)],
            } for item in detector.detect(frame)]
    finally:
        cap.release()

    result = evaluate_ball_ground_truth(annotations, predictions)
    result.update({
        "inference": "NEW_NEURAL_INFERENCE_ON_LISTED_EVALUABLE_FRAMES",
        "inputs": {
            "video_sha256": sha256_file(video),
            "model_sha256": sha256_file(model),
            "ground_truth_files": [str(path) for path in ground_truth_paths],
        },
        "settings": {"confidence": float(confidence), "imgsz": int(imgsz)},
        "predictions": {str(frame): rows for frame, rows in predictions.items()},
    })
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--ground-truth", action="append", required=True)
    parser.add_argument("--confidence", type=float, default=.05)
    parser.add_argument("--imgsz", type=int, default=960)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output = Path(args.output)
    if output.exists():
        raise ValueError(f"Output already exists: {output}")
    result = benchmark(
        args.video, args.model, args.ground_truth,
        confidence=args.confidence, imgsz=args.imgsz,
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

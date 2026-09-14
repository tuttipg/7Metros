import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from sevenmetros_ai.pipeline import analyze_video
from sevenmetros_ai.tracking import Detection


class _Detector:
    def detect(self, frame):
        x = float(frame["index"] * 5)
        return [Detection(x, 10, x + 20, 50, confidence=0.9)]


class _Capture:
    def __init__(self, path):
        self.frames = [{"index": 0}, {"index": 1}, {"index": 2}]
        self.released = False

    def isOpened(self):
        return True

    def get(self, prop):
        return {1: 25.0, 2: 640, 3: 360}.get(prop, 0)

    def read(self):
        if not self.frames:
            return False, None
        return True, self.frames.pop(0)

    def release(self):
        self.released = True


class _Writer:
    def __init__(self, path, fourcc, fps, size):
        self.path = path
        self.fps = fps
        self.size = size
        self.frames = []
        self.released = False

    def isOpened(self):
        return True

    def write(self, frame):
        self.frames.append(dict(frame))

    def release(self):
        self.released = True


class PipelineTests(unittest.TestCase):
    def test_pipeline_emits_jsonl_and_annotated_video_frames(self):
        state = {}

        def make_capture(path):
            state["capture"] = _Capture(path)
            return state["capture"]

        def make_writer(path, fourcc, fps, size):
            state["writer"] = _Writer(path, fourcc, fps, size)
            return state["writer"]

        fake_cv2 = types.SimpleNamespace(
            CAP_PROP_FPS=1,
            CAP_PROP_FRAME_WIDTH=2,
            CAP_PROP_FRAME_HEIGHT=3,
            FONT_HERSHEY_SIMPLEX=4,
            LINE_AA=8,
            VideoCapture=make_capture,
            VideoWriter=make_writer,
            VideoWriter_fourcc=lambda *codec: 1234,
            rectangle=lambda frame, *args, **kwargs: frame.setdefault("rectangles", 0) or frame.update(rectangles=1),
            putText=lambda frame, *args, **kwargs: frame.update(labelled=True),
        )

        with tempfile.TemporaryDirectory() as tmp, patch.dict(sys.modules, {"cv2": fake_cv2}):
            input_path = Path(tmp) / "match.mp4"
            output_jsonl = Path(tmp) / "tracks.jsonl"
            output_video = Path(tmp) / "annotated.mp4"
            input_path.write_bytes(b"fake")

            summary = analyze_video(
                input_path,
                _Detector(),
                output_jsonl=output_jsonl,
                output_video=output_video,
                max_distance=30,
            )

            rows = [json.loads(line) for line in output_jsonl.read_text(encoding="utf-8").splitlines()]
            self.assertEqual(summary["frames_processed"], 3)
            self.assertEqual(summary["detections_total"], 3)
            self.assertEqual(summary["unique_tracks"], 1)
            self.assertEqual(summary["output_video"], str(output_video))
            self.assertEqual(len(rows), 3)
            self.assertEqual([row["objects"][0]["track_id"] for row in rows], [1, 1, 1])
            self.assertEqual(len(state["writer"].frames), 3)
            self.assertTrue(all(frame.get("labelled") for frame in state["writer"].frames))
            self.assertEqual(state["writer"].fps, 25.0)
            self.assertEqual(state["writer"].size, (640, 360))
            self.assertTrue(state["capture"].released)
            self.assertTrue(state["writer"].released)


if __name__ == "__main__":
    unittest.main()

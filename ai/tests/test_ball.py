import unittest
from types import SimpleNamespace

from sevenmetros_ai.ball import COCO_SPORTS_BALL_CLASS_ID, YoloSportsBallDetector


class FakeArray:
    def __init__(self, value): self.value = value
    def __getitem__(self, index): return self
    def tolist(self): return self.value


class FakeBox:
    def __init__(self, xyxy, confidence):
        self.xyxy = FakeArray(xyxy)
        self.conf = [confidence]


class FakeModel:
    def __init__(self, boxes): self.boxes = boxes; self.calls = []
    def predict(self, frame, **kwargs):
        self.calls.append(kwargs)
        return [SimpleNamespace(boxes=self.boxes)]


class BallDetectorTests(unittest.TestCase):
    def test_uses_coco_sports_ball_class_and_preserves_box(self):
        model = FakeModel([FakeBox([10, 20, 24, 35], .42)])
        detector = YoloSportsBallDetector(confidence=.05, imgsz=640, yolo_model=model)
        found = detector.detect(object())
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0].label, 'ball')
        self.assertEqual((found[0].x1, found[0].y1, found[0].x2, found[0].y2),
                         (10.0, 20.0, 24.0, 35.0))
        self.assertAlmostEqual(found[0].confidence, .42)
        self.assertEqual(model.calls[0]['classes'], [COCO_SPORTS_BALL_CLASS_ID])
        self.assertEqual(model.calls[0]['conf'], .05)
        self.assertEqual(model.calls[0]['imgsz'], 640)
        self.assertFalse(model.calls[0]['verbose'])

    def test_empty_result_is_not_interpolated(self):
        detector = YoloSportsBallDetector(yolo_model=FakeModel([]))
        self.assertEqual(detector.detect(object()), [])

    def test_custom_single_class_model_uses_configured_class_zero(self):
        model = FakeModel([])
        detector = YoloSportsBallDetector(class_id=0, yolo_model=model)
        detector.detect(object())
        self.assertEqual(detector.class_id, 0)
        self.assertEqual(model.calls[0]['classes'], [0])

    def test_validates_configuration(self):
        with self.assertRaises(ValueError):
            YoloSportsBallDetector(confidence=0, yolo_model=FakeModel([]))
        with self.assertRaises(ValueError):
            YoloSportsBallDetector(imgsz=0, yolo_model=FakeModel([]))
        for class_id in (-1, 1.5, True, "0"):
            with self.subTest(class_id=class_id), self.assertRaises(ValueError):
                YoloSportsBallDetector(class_id=class_id, yolo_model=FakeModel([]))


if __name__ == '__main__':
    unittest.main()

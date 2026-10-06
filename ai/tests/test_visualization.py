import unittest

from sevenmetros_ai.tracking import Detection, Track
from sevenmetros_ai.visualization import track_label


class VisualizationTests(unittest.TestCase):
    def test_track_label_contains_identity_confidence_and_team(self):
        track = Track(
            track_id=7,
            detection=Detection(10, 20, 30, 60, confidence=0.876, label="player", team="local"),
        )
        self.assertEqual(track_label(track), "player #7 0.88 [local]")

    def test_track_label_omits_team_when_unknown(self):
        track = Track(track_id=3, detection=Detection(0, 0, 10, 10, confidence=0.5))
        self.assertEqual(track_label(track), "player #3 0.50")


if __name__ == "__main__":
    unittest.main()

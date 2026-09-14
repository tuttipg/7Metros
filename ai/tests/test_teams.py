import unittest

from sevenmetros_ai.teams import chromatic_distance, classify_rgb


class TeamColorTests(unittest.TestCase):
    def test_brightness_changes_preserve_color_identity(self):
        self.assertAlmostEqual(
            chromatic_distance((220, 25, 25), (110, 12.5, 12.5)),
            0.0,
            places=9,
        )

    def test_classifies_clear_home_and_away_colors(self):
        refs = {"home": (210, 25, 25), "away": (25, 40, 210)}
        self.assertEqual(classify_rgb((180, 30, 28), refs), "home")
        self.assertEqual(classify_rgb((30, 45, 180), refs), "away")

    def test_ambiguous_sample_stays_unknown(self):
        refs = {"home": (200, 30, 30), "away": (30, 30, 200)}
        self.assertIsNone(classify_rgb((120, 30, 120), refs, min_margin=0.05))

    def test_distant_sample_stays_unknown(self):
        refs = {"home": (220, 20, 20), "away": (20, 20, 220)}
        self.assertIsNone(classify_rgb((30, 180, 30), refs, max_distance=0.15))

    def test_invalid_thresholds_are_rejected(self):
        with self.assertRaises(ValueError):
            classify_rgb((1, 2, 3), {"home": (1, 2, 3)}, max_distance=0)
        with self.assertRaises(ValueError):
            classify_rgb((1, 2, 3), {"home": (1, 2, 3)}, min_margin=-0.1)


if __name__ == "__main__":
    unittest.main()

import unittest

from sevenmetros_ai.teams import chromatic_distance, classify_rgb, fit_team_color_references


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

    def test_auto_calibration_finds_two_color_families_despite_brightness_changes(self):
        samples = [
            (220, 25, 25),
            (180, 22, 22),
            (120, 14, 14),
            (205, 30, 26),
            (25, 40, 220),
            (20, 32, 175),
            (15, 24, 130),
            (28, 46, 205),
        ]
        refs = fit_team_color_references(samples, team_names=("alpha", "beta"))
        labels = {
            classify_rgb((190, 24, 24), refs, max_distance=0.12),
            classify_rgb((24, 38, 190), refs, max_distance=0.12),
        }
        self.assertEqual(labels, {"alpha", "beta"})

    def test_auto_calibration_is_reproducible_when_input_order_changes(self):
        samples = [
            (220, 25, 25),
            (170, 20, 20),
            (25, 40, 220),
            (20, 32, 175),
            (205, 30, 26),
            (28, 46, 205),
        ]
        forward = fit_team_color_references(samples)
        backward = fit_team_color_references(list(reversed(samples)))
        self.assertEqual(forward, backward)

    def test_auto_calibration_rejects_single_color_family(self):
        samples = [
            (220, 25, 25),
            (180, 20, 20),
            (150, 18, 18),
            (120, 14, 14),
            (100, 12, 12),
            (80, 10, 10),
        ]
        with self.assertRaisesRegex(ValueError, "two separable color families|too similar"):
            fit_team_color_references(samples)


if __name__ == "__main__":
    unittest.main()

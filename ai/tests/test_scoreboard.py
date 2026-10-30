import unittest

from sevenmetros_ai.scoreboard import PersistentScoreGlyphDetector


class ScoreboardTests(unittest.TestCase):
    def test_persistent_change_is_reported_at_first_changed_frame(self):
        d = PersistentScoreGlyphDetector(
            "top", stable_frames=3, initial_stable_frames=1,
            change_fraction=.2, same_state_fraction=.05,
        )
        old = [0, 0, 0, 1, 1, 0, 0, 0, 0, 0]
        new = [0, 1, 1, 0, 0, 1, 0, 0, 0, 0]
        self.assertIsNone(d.update(0, old))
        self.assertIsNone(d.update(1, old))
        self.assertIsNone(d.update(2, new))
        self.assertIsNone(d.update(3, new))
        event = d.update(4, new)
        self.assertEqual(event.frame_index, 2)
        self.assertEqual(event.confirmation_frame, 4)
        self.assertEqual(event.side, "top")
        self.assertEqual(event.stable_frames, 3)

    def test_transient_change_is_rejected(self):
        d = PersistentScoreGlyphDetector(
            "bottom", stable_frames=3, initial_stable_frames=1,
            change_fraction=.2, same_state_fraction=.05,
        )
        old = [0] * 10
        transient = [1, 1, 1, 0, 0, 0, 0, 0, 0, 0]
        for frame, signature in enumerate((old, old, transient, old, old)):
            self.assertIsNone(d.update(frame, signature))

    def test_small_noise_is_same_state(self):
        d = PersistentScoreGlyphDetector(
            "top", stable_frames=2, initial_stable_frames=1,
            change_fraction=.3, same_state_fraction=.11,
        )
        old = [0] * 10
        noisy = [1] + [0] * 9
        self.assertIsNone(d.update(0, old))
        self.assertIsNone(d.update(1, noisy))
        self.assertIsNone(d.update(2, noisy))

    def test_requires_stable_initialization(self):
        d = PersistentScoreGlyphDetector(
            "top", initial_stable_frames=3, stable_frames=2,
            change_fraction=.2, same_state_fraction=.05,
        )
        a = [0] * 10
        b = [1, 1, 1] + [0] * 7
        c = [0, 0, 0, 1, 1, 1, 0, 0, 0, 0]
        self.assertIsNone(d.update(0, a))
        self.assertIsNone(d.update(1, b))
        self.assertIsNone(d.update(2, a))
        self.assertIsNone(d.update(3, a))
        self.assertIsNone(d.update(4, a))
        self.assertIsNone(d.update(5, c))
        event = d.update(6, c)
        self.assertEqual(event.frame_index, 5)

    def test_validates_input(self):
        with self.assertRaises(ValueError):
            PersistentScoreGlyphDetector("x", change_fraction=0)
        with self.assertRaises(ValueError):
            PersistentScoreGlyphDetector("x", same_state_fraction=.2, change_fraction=.1)
        d = PersistentScoreGlyphDetector("x", initial_stable_frames=1)
        with self.assertRaises(ValueError):
            d.update(0, [])
        with self.assertRaises(ValueError):
            d.update(0, [0, 2])


if __name__ == "__main__":
    unittest.main()

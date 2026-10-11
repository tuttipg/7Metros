import unittest

try:
    import cv2  # noqa: F401
    import numpy as np
except ImportError:
    cv2 = np = None

from sevenmetros_ai.temporal_ball_motion import (
    MotionCandidate, TemporalMotionBallProposer, link_motion_candidates,
)


@unittest.skipIf(cv2 is None, "optional OpenCV required")
class TemporalMotionBallTests(unittest.TestCase):
    def frames(self, centers):
        output = []
        for center in centers:
            frame = np.full((120, 160, 3), (190, 140, 70), dtype=np.uint8)
            if center is not None:
                cv2.circle(frame, center, 5, (20, 20, 20), -1)
            output.append(frame)
        return output

    def test_moving_dark_blob_is_proposed(self):
        previous, current, following = self.frames([(60, 80), (80, 80), (100, 80)])
        found = TemporalMotionBallProposer(top=0, bottom=120).propose(
            previous, current, following,
        )
        self.assertTrue(found)
        self.assertLess(min(
            ((item.center_xy[0] - 80) ** 2 + (item.center_xy[1] - 80) ** 2) ** .5
            for item in found
        ), 3)

    def test_stationary_dark_blob_is_not_proposed(self):
        frames = self.frames([(80, 80)] * 3)
        self.assertEqual(
            TemporalMotionBallProposer(top=0, bottom=120).propose(*frames), [],
        )

    def test_player_mask_removes_blob(self):
        frames = self.frames([(60, 80), (80, 80), (100, 80)])
        found = TemporalMotionBallProposer(top=0, bottom=120).propose(
            *frames, player_boxes=[(70, 70, 90, 90)],
        )
        self.assertFalse(any(abs(item.center_xy[0] - 80) < 8 for item in found))

    def test_linear_candidates_form_tracklet(self):
        def candidate(x):
            return MotionCandidate((x, 20, x + 4, 24), (x + 2, 22), 12, 20, 100)
        found = link_motion_candidates([(1, [candidate(10)]), (2, [candidate(20)]),
                                        (3, [candidate(30)])])
        self.assertEqual(found[0].frames, 3)
        self.assertAlmostEqual(found[0].linearity, 1)


if __name__ == "__main__":
    unittest.main()

import unittest

from sevenmetros_ai.ball_tracking import BallObservation
from sevenmetros_ai.possession import assign_possession_candidate
from sevenmetros_ai.tracking import Detection, Track


def track(track_id, x1, y1, x2, y2, team=None):
    return Track(track_id=track_id, detection=Detection(
        x1=x1, y1=y1, x2=x2, y2=y2, label='player', team=team,
    ), association_team=team)


def ball(cx, cy, segment=1):
    detection = Detection(
        x1=cx - 5, y1=cy - 5, x2=cx + 5, y2=cy + 5,
        confidence=.5, label='ball',
    )
    return BallObservation(detection, segment, 'strong', 0, None)


class PossessionCandidateTests(unittest.TestCase):
    def test_unobserved_ball_stays_unknown(self):
        result = assign_possession_candidate(None, [track(1, 0, 0, 20, 100, 'Ferro')])
        self.assertEqual(result.state, 'ball_unobserved')
        self.assertIsNone(result.track_id)

    def test_ball_inside_clear_player_box_is_candidate(self):
        result = assign_possession_candidate(
            ball(10, 20),
            [track(1, 0, 0, 20, 100, 'Ferro'), track(2, 100, 0, 120, 100, 'Lujan')],
        )
        self.assertEqual(result.state, 'candidate')
        self.assertEqual(result.track_id, 1)
        self.assertEqual(result.team, 'Ferro')
        self.assertEqual(result.normalized_distance, 0)

    def test_close_competitors_are_ambiguous(self):
        result = assign_possession_candidate(
            ball(50, 50),
            [track(1, 0, 0, 40, 100), track(2, 60, 0, 100, 100)],
            max_normalized_distance=.5, min_margin_to_second=.05,
        )
        self.assertEqual(result.state, 'observed_ambiguous')
        self.assertIsNone(result.track_id)

    def test_far_ball_is_unassigned(self):
        result = assign_possession_candidate(
            ball(200, 200), [track(1, 0, 0, 20, 100)],
            max_normalized_distance=.35,
        )
        self.assertEqual(result.state, 'observed_unassigned')

    def test_normalizes_distance_by_player_height(self):
        result = assign_possession_candidate(
            ball(50, 50),
            [track(1, 0, 0, 30, 50), track(2, 70, 0, 90, 200)],
            max_normalized_distance=.2, min_margin_to_second=.05,
        )
        self.assertEqual(result.state, 'candidate')
        self.assertEqual(result.track_id, 2)

    def test_empty_players_is_unassigned(self):
        result = assign_possession_candidate(ball(10, 10, segment=4), [])
        self.assertEqual(result.state, 'observed_unassigned')
        self.assertEqual(result.ball_segment_id, 4)

    def test_validates_thresholds(self):
        with self.assertRaises(ValueError):
            assign_possession_candidate(ball(0, 0), [], max_normalized_distance=-1)
        with self.assertRaises(ValueError):
            assign_possession_candidate(ball(0, 0), [], min_margin_to_second=-1)


if __name__ == '__main__':
    unittest.main()

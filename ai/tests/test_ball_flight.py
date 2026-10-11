import unittest

from sevenmetros_ai.ball_flight import detect_free_ball_flights


def ball_row(frame, x=None, y=None, segment=1):
    obs = None if x is None else {
        'bbox_xyxy': [x-5, y-5, x+5, y+5], 'segment_id': segment,
    }
    return {'frame_index': frame, 'observation': obs}


def pos_row(frame, state):
    return {'frame_index': frame, 'state': state}


class BallFlightTests(unittest.TestCase):
    def test_detects_fast_linear_unassigned_run(self):
        balls = [ball_row(i, i*10, 0) for i in range(4)]
        pos = [pos_row(i, 'observed_unassigned') for i in range(4)]
        flights = detect_free_ball_flights(balls, pos, min_frames=3, min_mean_speed_px_per_frame=8)
        self.assertEqual(len(flights), 1)
        self.assertEqual((flights[0].start_frame, flights[0].end_frame), (0,3))
        self.assertAlmostEqual(flights[0].linearity, 1)

    def test_possession_breaks_flight(self):
        balls = [ball_row(i, i*10, 0) for i in range(4)]
        pos = [pos_row(0,'observed_unassigned'), pos_row(1,'candidate'), pos_row(2,'observed_unassigned'), pos_row(3,'observed_unassigned')]
        self.assertEqual(detect_free_ball_flights(balls, pos), [])

    def test_missing_observation_breaks_flight(self):
        balls = [ball_row(0,0,0), ball_row(1,10,0), ball_row(2), ball_row(3,30,0), ball_row(4,40,0)]
        pos = [pos_row(i,'observed_unassigned') for i in range(5)]
        self.assertEqual(detect_free_ball_flights(balls, pos), [])

    def test_slow_or_zigzag_run_rejected(self):
        slow = [ball_row(i, i*2, 0) for i in range(4)]
        pos = [pos_row(i,'observed_unassigned') for i in range(4)]
        self.assertEqual(detect_free_ball_flights(slow, pos), [])
        zig = [ball_row(0,0,0), ball_row(1,20,0), ball_row(2,0,0), ball_row(3,20,0)]
        self.assertEqual(detect_free_ball_flights(zig, pos, min_linearity=.7), [])

    def test_segment_change_breaks_run(self):
        balls = [ball_row(0,0,0,1), ball_row(1,10,0,1), ball_row(2,20,0,2), ball_row(3,30,0,2)]
        pos = [pos_row(i,'observed_unassigned') for i in range(4)]
        self.assertEqual(detect_free_ball_flights(balls,pos), [])

    def test_validates_settings_and_order(self):
        with self.assertRaises(ValueError): detect_free_ball_flights([], [], min_frames=1)
        with self.assertRaises(ValueError): detect_free_ball_flights([], [], min_mean_speed_px_per_frame=-1)
        with self.assertRaises(ValueError): detect_free_ball_flights([], [], min_linearity=2)
        with self.assertRaises(ValueError): detect_free_ball_flights([ball_row(2), ball_row(1)], [])


if __name__ == '__main__': unittest.main()

import unittest

from sevenmetros_ai.events import stable_candidate_runs, detect_control_change_candidates


def row(frame, state='ball_unobserved', track_id=None, team=None):
    return {'frame_index': frame, 'state': state, 'track_id': track_id, 'team': team}


class EventCandidateTests(unittest.TestCase):
    def test_requires_stable_runs(self):
        rows = [
            row(0, 'candidate', 1, 'Ferro'),
            row(1),
            row(2, 'candidate', 2, 'Lujan'),
            row(3, 'candidate', 2, 'Lujan'),
        ]
        runs = stable_candidate_runs(rows, min_run_frames=2)
        self.assertEqual([(r.track_id, r.frames) for r in runs], [(2, 2)])

    def test_same_team_transition_is_not_called_pass(self):
        rows = [
            row(0, 'candidate', 1, 'Ferro'), row(1, 'candidate', 1, 'Ferro'),
            row(2, 'observed_unassigned'),
            row(3, 'candidate', 2, 'Ferro'), row(4, 'candidate', 2, 'Ferro'),
        ]
        events = detect_control_change_candidates(rows, max_transition_gap_frames=2)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].kind, 'same_team_control_change_candidate')
        self.assertEqual(events[0].gap_frames, 1)

    def test_opponent_transition_is_candidate_only(self):
        rows = [
            row(0, 'candidate', 1, 'Ferro'), row(1, 'candidate', 1, 'Ferro'),
            row(2, 'candidate', 3, 'Lujan'), row(3, 'candidate', 3, 'Lujan'),
        ]
        event = detect_control_change_candidates(rows)[0]
        self.assertEqual(event.kind, 'opponent_control_change_candidate')
        self.assertEqual(event.frame_index, 2)
        self.assertEqual(event.source_track_id, 1)
        self.assertEqual(event.target_track_id, 3)

    def test_long_gap_is_not_event(self):
        rows = [
            row(0, 'candidate', 1, 'Ferro'), row(1, 'candidate', 1, 'Ferro'),
            row(2), row(3), row(4), row(5), row(6),
            row(7, 'candidate', 2, 'Lujan'), row(8, 'candidate', 2, 'Lujan'),
        ]
        self.assertEqual(detect_control_change_candidates(rows, max_transition_gap_frames=4), [])

    def test_same_player_restart_is_not_change(self):
        rows = [
            row(0, 'candidate', 1, 'Ferro'), row(1, 'candidate', 1, 'Ferro'),
            row(2, 'observed_unassigned'),
            row(3, 'candidate', 1, 'Ferro'), row(4, 'candidate', 1, 'Ferro'),
        ]
        self.assertEqual(detect_control_change_candidates(rows), [])

    def test_validates_order_and_settings(self):
        with self.assertRaises(ValueError): stable_candidate_runs([row(2), row(1)])
        with self.assertRaises(ValueError): stable_candidate_runs([], min_run_frames=0)
        with self.assertRaises(ValueError): detect_control_change_candidates([], max_transition_gap_frames=-1)
        with self.assertRaises(ValueError): stable_candidate_runs([row(0, 'candidate', None, 'Ferro')])


if __name__ == '__main__': unittest.main()

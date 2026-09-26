import unittest
from sevenmetros_ai.tracking import CentroidTracker, Detection
from sevenmetros_ai.fixture_kits import classify_kit


class RecoveredTests(unittest.TestCase):
    def obs(self, t, team=None, role=None, x=0):
        return t.update([Detection(x, 0, x+20, 40, team=team, role_candidate=role)])[0]

    def test_temporal_requires_three(self):
        t=CentroidTracker(temporal_teams=True)
        self.assertIsNone(self.obs(t,'a').detection.team)
        self.assertIsNone(self.obs(t,'a').detection.team)
        self.assertEqual(self.obs(t,'a').detection.team,'a')

    def test_one_wrong_color_does_not_fragment(self):
        t=CentroidTracker(temporal_teams=True)
        for _ in range(3): self.obs(t,'a')
        obs=self.obs(t,'b')
        self.assertEqual((obs.track_id,obs.detection.team),(1,'a'))

    def test_consistent_new_color_corrects(self):
        t=CentroidTracker(temporal_teams=True)
        for _ in range(3): self.obs(t,'a')
        for _ in range(12): obs=self.obs(t,'b')
        self.assertEqual((obs.track_id,obs.detection.team),(1,'b'))

    def test_unknown_expires(self):
        t=CentroidTracker(temporal_teams=True)
        for _ in range(3): self.obs(t,'a')
        for _ in range(12): obs=self.obs(t)
        self.assertIsNone(obs.detection.team)

    def test_role_stays_candidate(self):
        t=CentroidTracker(temporal_teams=True)
        for _ in range(3): obs=self.obs(t,role='referee')
        self.assertEqual(obs.detection.label,'player')
        self.assertEqual(obs.detection.role_candidate,'referee')
        self.assertIsNone(obs.detection.team)

    def test_history_cleaned(self):
        t=CentroidTracker(temporal_teams=True,max_missed=0)
        self.obs(t,role='referee');t.update([])
        self.assertFalse(t._roles or t._team_history or t._role_history)

    def test_kits(self):
        for rgb,expected in [((151,178,222),('Ferro',None)),((52,63,139),('Lujan',None)),
          ((116,47,87),(None,'Lujan_GK')),((51,36,74),(None,'Ferro_GK')),
          ((15,22,44),(None,'referee')),((36,30,177),(None,None))]:
            with self.subTest(rgb=rgb):self.assertEqual(classify_kit(rgb),expected)

    def test_velocity_alpha_validation(self):
        for value in [0,-1,1.1,float('nan')]:
            with self.assertRaises(ValueError):CentroidTracker(velocity_alpha=value)

    def test_smoothing_survives_jitter_then_gap(self):
        # Stationary person; one noisy box must not create huge extrapolation.
        t=CentroidTracker(max_distance=20,max_missed=3,velocity_alpha=.25)
        for x in (0,0,10):self.obs(t,x=x)
        t.update([]);t.update([])
        self.assertEqual(self.obs(t,x=0).track_id,1)

    def test_initial_motion_not_damped(self):
        t=CentroidTracker(velocity_alpha=.25)
        self.obs(t,x=0)
        self.assertEqual(self.obs(t,x=8).velocity_x,8)

    def test_label_gate_preserved(self):
        t=CentroidTracker(temporal_teams=True,velocity_alpha=.25)
        self.obs(t)
        self.assertEqual(t.update([Detection(0,0,20,40,label='ball')])[0].track_id,2)

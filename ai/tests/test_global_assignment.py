import unittest
import importlib.util
from sevenmetros_ai.tracking import CentroidTracker, Detection


@unittest.skipUnless(importlib.util.find_spec('scipy'), 'optional scipy required')
class GlobalAssignmentTests(unittest.TestCase):
    def test_joint_assignment_avoids_greedy_dead_end(self):
        def d(x):return Detection(x,0,x+2,10)
        t=CentroidTracker(max_distance=15,iou_weight=0,assignment='global')
        t.update([d(0),d(10)])
        result=t.update([d(6),d(20)])
        self.assertEqual([(r.track_id,r.detection.x1) for r in result],[(1,6),(2,20)])

    def test_forbidden_label_cannot_be_assigned(self):
        t=CentroidTracker(assignment='global')
        t.update([Detection(0,0,10,20)])
        result=t.update([Detection(0,0,10,20,label='ball')])
        self.assertEqual(result[0].track_id,2)

    def test_unmatched_rows_and_empty_frames(self):
        t=CentroidTracker(assignment='global',max_distance=10)
        t.update([Detection(0,0,10,20),Detection(100,0,110,20)])
        self.assertEqual(t.update([]),[])
        result=t.update([Detection(1,0,11,20)])
        self.assertEqual([r.track_id for r in result],[1])

    def test_invalid_method_rejected(self):
        with self.assertRaises(ValueError):CentroidTracker(assignment='invalid')

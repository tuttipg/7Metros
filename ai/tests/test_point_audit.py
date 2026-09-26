import unittest
from audit_points import audit


class PointAuditTests(unittest.TestCase):
    def test_two_boxes_are_ambiguous_not_correct(self):
        ref={'width':20,'height':20,'scope':'test','points':[{'frame':0,'person':'a','xy':[5,5]}]}
        frames={0:{'image':{'width':20,'height':20},'objects':[
            {'track_id':1,'bbox_xyxy':[0,0,10,10]}, {'track_id':2,'bbox_xyxy':[0,0,10,10]}]}}
        result=audit(ref,frames)
        self.assertEqual(result['ambiguous'],1)
        self.assertEqual(result['matched'],0)

    def test_missing_reference_frame_fails(self):
        with self.assertRaises(ValueError):
            audit({'points':[{'frame':0}]},{})

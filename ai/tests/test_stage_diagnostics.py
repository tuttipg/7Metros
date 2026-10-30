import unittest
from diagnose_stages import diagnose_frame, point_status
from sevenmetros_ai.tracking import Detection


class StageDiagnosticsTests(unittest.TestCase):
    def test_duplicate_and_court_counts_are_separate(self):
        raw=[dict(x1=0,y1=0,x2=10,y2=20,confidence=.9),
             dict(x1=0,y1=0,x2=10,y2=20,confidence=.8),
             dict(x1=50,y1=0,x2=60,y2=20,confidence=.7)]
        row={'frame_index':0,'objects':[{'bbox_xyxy':[0,0,10,20],'kind':'player','confidence':.9}]}
        r=diagnose_frame(raw,row)
        self.assertEqual((r['raw'],r['duplicate_rule_removals'],r['court_stage_removals'],r['output']),(3,1,1,1))

    def test_unknown_output_box_fails(self):
        with self.assertRaises(ValueError):
            diagnose_frame([],{'frame_index':0,'objects':[{'bbox_xyxy':[0,0,10,20],'kind':'player','confidence':.9}]})

    def test_merged_box_is_visible_at_detector_stage(self):
        points=[{'person':'a','xy':[2,3]},{'person':'b','xy':[5,6]}]
        statuses=point_status([Detection(0,0,10,20)],points)
        self.assertEqual([r['status'] for r in statuses],['shared_box','shared_box'])

    def test_schema_rounding_does_not_falsely_reject_output(self):
        r=diagnose_frame([dict(x1=.00011,y1=0,x2=10,y2=20,confidence=.91234567)],
            {'frame_index':0,'objects':[{'bbox_xyxy':[0,0,10,20],'kind':'player','confidence':.912346}]})
        self.assertEqual(r['output'],1)

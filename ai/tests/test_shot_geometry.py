import unittest
from types import SimpleNamespace
from sevenmetros_ai.shot_geometry import goal_mouth_proxies, detect_shot_geometry_candidates


def player(frame, gx, role='Lujan_GK'):
    return {'frame_index':frame,'image':{'width':936,'height':524},'objects':[
        {'track_id':10,'role_candidate':role,'bbox_xyxy':[gx-20,120,gx+20,190]},
        {'track_id':99,'role_candidate':'referee','bbox_xyxy':[500,100,540,200]},
    ]}

def ball(frame,x,y,segment=1):
    return {'frame_index':frame,'observation':{'segment_id':segment,'bbox_xyxy':[x-5,y-5,x+5,y+5]}}

class ShotGeometryTests(unittest.TestCase):
    def test_proxy_follows_goalkeeper_pan_and_ignores_referee(self):
        left=goal_mouth_proxies(player(1,270));right=goal_mouth_proxies(player(2,720,'Ferro_GK'))
        self.assertEqual(len(left),1);self.assertEqual(len(right),1)
        self.assertLess(left[0].bbox_xyxy[0],300)
        self.assertGreater(right[0].bbox_xyxy[0],600)
        self.assertEqual(right[0].defending_team,'Ferro')

    def test_forward_flight_into_proxy_is_candidate(self):
        f=SimpleNamespace(start_frame=10,end_frame=12,segment_id=1)
        rows=[ball(10,500,300),ball(11,430,250),ball(12,360,200)]
        found=detect_shot_geometry_candidates([f],rows,[player(12,270)])
        self.assertEqual(len(found),1)
        self.assertEqual(found[0].goal_role_candidate,'Lujan_GK')
        self.assertGreater(found[0].projected_frames,0)

    def test_flight_missing_goal_corridor_is_not_candidate(self):
        f=SimpleNamespace(start_frame=10,end_frame=12,segment_id=1)
        rows=[ball(10,500,300),ball(11,430,310),ball(12,360,320)]
        self.assertEqual(detect_shot_geometry_candidates([f],rows,[player(12,270)]),[])

    def test_no_goalkeeper_means_no_candidate(self):
        f=SimpleNamespace(start_frame=10,end_frame=12,segment_id=1)
        rows=[ball(10,500,300),ball(11,430,250),ball(12,360,200)]
        pr={'frame_index':12,'image':{'width':936,'height':524},'objects':[]}
        self.assertEqual(detect_shot_geometry_candidates([f],rows,[pr]),[])

    def test_requires_detector_backed_points(self):
        f=SimpleNamespace(start_frame=10,end_frame=12,segment_id=1)
        rows=[ball(10,500,300),{'frame_index':11,'observation':None},ball(12,360,200)]
        self.assertEqual(detect_shot_geometry_candidates([f],rows,[player(12,270)]),[])

if __name__=='__main__': unittest.main()

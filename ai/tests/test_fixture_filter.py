import unittest
from sevenmetros_ai.fixture_filter import suppress_duplicates
from sevenmetros_ai.tracking import Detection

class FilterTests(unittest.TestCase):
    def test_duplicate_keeps_high_confidence(self):
        a=Detection(0,0,20,40,.9)
        b=Detection(1,0,21,40,.5)
        self.assertEqual(suppress_duplicates([b,a]),[a])
    def test_distinct_people_and_roles_survive(self):
        ds=[Detection(0,0,20,40),Detection(15,0,35,40),Detection(0,0,20,40,label='referee')]
        self.assertEqual(len(suppress_duplicates(ds)),3)

    def test_blue_floor_rejects_outside_person(self):
        try:
            import cv2
            import numpy as np
        except ImportError:
            self.skipTest('optional vision dependencies not installed')
        from sevenmetros_ai.fixture_filter import BlueCourtClassifier
        image=np.zeros((300,400,3),dtype=np.uint8)
        image[100:,:,:]=(220,150,70)
        inside=Detection(100,130,120,240)
        outside=Detection(10,10,30,50)
        out=BlueCourtClassifier().classify(image,[inside,outside])
        self.assertEqual(len(out),1)
        self.assertEqual(out[0].x1,100)

    def test_no_blue_floor_does_not_claim_players(self):
        try:
            import numpy as np
            import cv2
        except ImportError:
            self.skipTest('optional vision dependencies not installed')
        from sevenmetros_ai.fixture_filter import BlueCourtClassifier
        self.assertEqual(BlueCourtClassifier().classify(np.zeros((100,100,3),dtype=np.uint8),[Detection(0,0,20,40)]),[])

    def test_blue_court_presence_reuses_classifier_threshold(self):
        try:
            import cv2
            import numpy as np
        except ImportError:
            self.skipTest('optional vision dependencies not installed')
        from sevenmetros_ai.fixture_filter import blue_court_fraction, blue_court_present
        image = np.zeros((100, 100, 3), dtype=np.uint8)
        image[20:, :] = (220, 150, 70)
        self.assertGreater(blue_court_fraction(image), .15)
        self.assertTrue(blue_court_present(image))
        self.assertFalse(blue_court_present(np.zeros_like(image)))
        with self.assertRaises(ValueError):
            blue_court_present(image, min_fraction=0)

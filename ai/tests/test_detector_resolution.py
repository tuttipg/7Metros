import argparse
import unittest

from benchmark_detector_resolution import parse_range, summarize_points, validate_ranges
from sevenmetros_ai.tracking import Detection


class DetectorResolutionTests(unittest.TestCase):
    def test_range_validation_is_ordered_and_disjoint(self):
        self.assertEqual(validate_ranges([(10, 20), (0, 5)]), [(0, 5), (10, 20)])
        with self.assertRaisesRegex(ValueError, 'overlap'):
            validate_ranges([(0, 10), (9, 20)])
        with self.assertRaisesRegex(ValueError, 'At least one'):
            validate_ranges([])
        for value in ['x:2', '2:2', '-1:2']:
            with self.assertRaises(argparse.ArgumentTypeError):
                parse_range(value)

    def test_shared_box_is_never_counted_as_two_unique_points(self):
        points = {5: [
            {'frame': 5, 'person': 'a', 'xy': [5, 5]},
            {'frame': 5, 'person': 'b', 'xy': [7, 7]},
        ]}
        detections = {5: [Detection(0, 0, 10, 10, confidence=.8)]}
        result = summarize_points(detections, points)
        self.assertEqual(result['counts']['shared_box'], 2)
        self.assertEqual(result['counts']['unique_box'], 0)


if __name__ == '__main__':
    unittest.main()

import unittest

from benchmark_selective_resolution import validate_prior_run
from sevenmetros_ai.selective_resolution import (
    contact_regions,
    fuse_resolution_regions,
    fuse_resolution_regions_with_spawn_mask,
    merged_box_frames,
    select_resolution,
)
from sevenmetros_ai.tracking import Detection, Track


def box(x1, y1, x2, y2, confidence=.8):
    return Detection(x1, y1, x2, y2, confidence=confidence)


class SelectiveResolutionTests(unittest.TestCase):
    def test_temporal_split_triggers_current_merged_frame(self):
        detections = {
            9: [box(0, 0, 8, 20), box(12, 0, 20, 20)],
            10: [box(0, 0, 20, 20)],
        }
        self.assertEqual(merged_box_frames(detections), {10})

    def test_duplicate_neighbor_boxes_do_not_trigger(self):
        detections = {
            9: [box(0, 0, 10, 20, .9), box(1, 0, 11, 20, .3)],
            10: [box(0, 0, 12, 20)],
        }
        self.assertEqual(merged_box_frames(detections), set())

    def test_selection_requires_matching_cache_frames(self):
        baseline = {1: [box(0, 0, 1, 2)]}
        candidate = {1: [box(0, 0, 2, 2)]}
        self.assertIs(select_resolution(baseline, candidate, {1})[1], candidate[1])
        with self.assertRaisesRegex(ValueError, 'identical frames'):
            select_resolution(baseline, {}, set())
        with self.assertRaisesRegex(ValueError, 'absent'):
            select_resolution(baseline, candidate, {2})

    def test_trigger_parameters_are_validated(self):
        with self.assertRaises(ValueError):
            merged_box_frames({}, coverage=0)
        with self.assertRaises(ValueError):
            merged_box_frames({}, pair_iou=2)
        with self.assertRaises(ValueError):
            merged_box_frames({}, min_aspect=0)

    def test_prior_inference_metadata_must_match_caches(self):
        prior = {'configurations': {
            'baseline': {'detections_sha256': 'base', 'frames': 2},
            'candidate': {'detections_sha256': 'candidate', 'frames': 2},
        }}
        validate_prior_run(prior, 'base', 'candidate', 2)
        with self.assertRaisesRegex(ValueError, 'hash'):
            validate_prior_run(prior, 'wrong', 'candidate', 2)
        with self.assertRaisesRegex(ValueError, 'frame count'):
            validate_prior_run(prior, 'base', 'candidate', 3)

    def test_contact_region_requires_two_separated_live_tracks(self):
        region = box(0, 0, 20, 20)
        tracks = [
            Track(1, box(2, 2, 6, 10)),
            Track(2, box(14, 2, 18, 10)),
        ]
        self.assertEqual(contact_regions([region], tracks), [region])
        tracks[1].missed = 7
        self.assertEqual(contact_regions([region], tracks), [])

    def test_local_fusion_preserves_boxes_outside_contact(self):
        outside = box(50, 0, 60, 20)
        merged = box(0, 0, 20, 20)
        split_a = box(0, 0, 9, 20)
        split_b = box(11, 0, 20, 20)
        result = fuse_resolution_regions(
            [merged, outside], [split_a, split_b, box(70, 0, 80, 20)], [merged],
        )
        self.assertEqual(result, [outside, split_a, split_b])

        result, spawnable = fuse_resolution_regions_with_spawn_mask(
            [merged, outside], [split_a, split_b], [merged],
        )
        self.assertEqual(result, [outside, split_a, split_b])
        self.assertEqual(spawnable, [True, False, False])

    def test_single_replacement_keeps_baseline_contact_observation(self):
        merged = box(0, 0, 20, 20)
        outside = box(50, 0, 60, 20)
        result, spawnable = fuse_resolution_regions_with_spawn_mask(
            [merged, outside], [box(0, 0, 9, 20)], [merged],
        )
        self.assertEqual(result, [merged, outside])
        self.assertEqual(spawnable, [True, True])

    def test_minimum_replacements_is_validated(self):
        with self.assertRaisesRegex(ValueError, 'min_replacements'):
            fuse_resolution_regions([], [], [], min_replacements=0)


if __name__ == '__main__':
    unittest.main()

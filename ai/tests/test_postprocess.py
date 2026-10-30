import unittest

from sevenmetros_ai.postprocess import interpolate_short_internal_gaps


def row(frame, objects):
    return {
        "schema": "7metros-ai.v1",
        "frame_index": frame,
        "timestamp_ms": frame * 33.333,
        "image": {"width": 100, "height": 100},
        "objects": objects,
    }


def obj(track_id, box, *, kind="player", confidence=.8, team="Ferro"):
    x1, y1, x2, y2 = box
    return {
        "track_id": track_id,
        "kind": kind,
        "confidence": confidence,
        "bbox_xyxy": list(box),
        "center_xy": [(x1 + x2) / 2, (y1 + y2) / 2],
        "velocity_xy": [0, 0],
        "team": team,
    }


class ShortGapInterpolationTests(unittest.TestCase):
    def test_interpolates_short_internal_gap(self):
        rows = [
            row(0, [obj(7, (10, 10, 20, 30), confidence=.9)]),
            row(1, []),
            row(2, []),
            row(3, [obj(7, (40, 10, 50, 30), confidence=.6)]),
        ]
        output, report = interpolate_short_internal_gaps(rows, max_missing_frames=2)
        self.assertEqual(report["filled_gaps"], 1)
        self.assertEqual(report["interpolated_observations"], 2)
        self.assertEqual(report["track_ids_affected"], [7])
        self.assertEqual(output[1]["objects"][0]["bbox_xyxy"], [20.0, 10.0, 30.0, 30.0])
        self.assertEqual(output[2]["objects"][0]["bbox_xyxy"], [30.0, 10.0, 40.0, 30.0])
        self.assertEqual(output[1]["objects"][0]["confidence"], .6)
        self.assertTrue(output[1]["objects"][0]["interpolated"])
        self.assertEqual(output[1]["objects"][0]["interpolation_gap_frames"], 2)
        self.assertEqual(output[1]["objects"][0]["velocity_xy"], [10.0, 0.0])

    def test_does_not_fill_gap_above_limit(self):
        rows = [row(0, [obj(1, (10, 10, 20, 20))])] + [row(i, []) for i in range(1, 4)] + [
            row(4, [obj(1, (14, 10, 24, 20))])
        ]
        output, report = interpolate_short_internal_gaps(rows, max_missing_frames=2)
        self.assertEqual(report["interpolated_observations"], 0)
        self.assertTrue(all(not frame["objects"] for frame in output[1:4]))

    def test_never_extrapolates_before_or_after_track(self):
        rows = [
            row(0, []),
            row(1, [obj(3, (10, 10, 20, 20))]),
            row(2, []),
            row(3, [obj(3, (12, 10, 22, 20))]),
            row(4, []),
        ]
        output, report = interpolate_short_internal_gaps(rows, max_missing_frames=5)
        self.assertEqual(report["interpolated_observations"], 1)
        self.assertEqual(output[0]["objects"], [])
        self.assertEqual(output[4]["objects"], [])

    def test_does_not_bridge_kind_change(self):
        rows = [
            row(0, [obj(4, (10, 10, 20, 20), kind="player")]),
            row(1, []),
            row(2, [obj(4, (12, 10, 22, 20), kind="referee")]),
        ]
        output, report = interpolate_short_internal_gaps(rows, max_missing_frames=5)
        self.assertEqual(report["interpolated_observations"], 0)
        self.assertEqual(output[1]["objects"], [])

    def test_team_only_propagates_when_endpoint_labels_agree(self):
        rows = [
            row(0, [obj(5, (10, 10, 20, 20), team="Ferro")]),
            row(1, []),
            row(2, [obj(5, (12, 10, 22, 20), team="Lujan")]),
        ]
        output, _ = interpolate_short_internal_gaps(rows, max_missing_frames=5)
        self.assertIsNone(output[1]["objects"][0]["team"])

    def test_rejects_duplicate_id_in_one_frame(self):
        rows = [row(0, [obj(1, (10, 10, 20, 20)), obj(1, (30, 30, 40, 40))])]
        with self.assertRaisesRegex(ValueError, "Duplicate track_id"):
            interpolate_short_internal_gaps(rows)

    def test_rejects_non_contiguous_frames(self):
        rows = [row(0, []), row(2, [])]
        with self.assertRaisesRegex(ValueError, "contiguous"):
            interpolate_short_internal_gaps(rows)

    def test_input_is_not_mutated(self):
        rows = [
            row(0, [obj(1, (10, 10, 20, 20))]),
            row(1, []),
            row(2, [obj(1, (12, 10, 22, 20))]),
        ]
        interpolate_short_internal_gaps(rows)
        self.assertEqual(rows[1]["objects"], [])


if __name__ == "__main__":
    unittest.main()

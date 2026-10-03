import argparse
import unittest

from compare_trackers_video import display_label, parse_track_spec, tracks_from_row


class CompareTrackersVideoTests(unittest.TestCase):
    def test_track_spec_requires_label_and_path(self):
        self.assertEqual(parse_track_spec('ByteTrack=out.jsonl')[0], 'ByteTrack')
        for invalid in ['out.jsonl', '=out.jsonl', 'ByteTrack=']:
            with self.assertRaises(argparse.ArgumentTypeError):
                parse_track_spec(invalid)

    def test_display_label_is_safe_for_opencv_font(self):
        self.assertEqual(display_label('ByteTrack estándar'), 'ByteTrack estandar')

    def test_row_validation_and_track_conversion(self):
        row = {
            'frame_index': 12,
            'timestamp_ms': 400.0,
            'image': {'width': 100, 'height': 50},
            'objects': [{
                'track_id': 7,
                'kind': 'player',
                'team': 'Ferro',
                'role_candidate': None,
                'confidence': .8,
                'bbox_xyxy': [1, 2, 11, 22],
            }],
        }
        tracks = tracks_from_row(
            row, frame_index=12, timestamp_ms=400.0, width=100, height=50,
        )
        self.assertEqual(tracks[0].track_id, 7)
        self.assertEqual(tracks[0].detection.team, 'Ferro')
        with self.assertRaisesRegex(ValueError, 'Timestamp'):
            tracks_from_row(
                row, frame_index=12, timestamp_ms=500.0, width=100, height=50,
            )


if __name__ == '__main__':
    unittest.main()

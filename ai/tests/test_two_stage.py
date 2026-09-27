import unittest
from sevenmetros_ai.tracking import CentroidTracker, Detection


def box(x=0, confidence=.9, team='ferro', label='player'):
    return Detection(x, 0, x+20, 40, confidence, label, team)


class TwoStageTests(unittest.TestCase):
    def test_weak_bridge_preserves_identity_vs_high_only(self):
        old = CentroidTracker(max_missed=1)
        new = CentroidTracker(max_missed=1, two_stage=True)
        old_ids, new_ids = [], []
        for confidence in [.9, .15, .15, .15, .9]:
            old_ids.extend(t.track_id for t in old.update([box(confidence=confidence)] if confidence >= .25 else []))
            new_ids.extend(t.track_id for t in new.update([box(confidence=confidence)]))
        self.assertEqual(old_ids, [1, 2])
        self.assertEqual(new_ids, [1]*5)

    def test_weak_never_spawns_and_below_low_is_ignored(self):
        tracker = CentroidTracker(two_stage=True)
        self.assertEqual(tracker.update([box(confidence=.15)]), [])
        tracker.update([box()])
        self.assertEqual(tracker.update([box(confidence=.09)]), [])

    def test_high_stage_has_priority(self):
        tracker = CentroidTracker(two_stage=True)
        tracker.update([box()])
        result = tracker.update([box(confidence=.15), box(x=2)])
        self.assertEqual([(t.track_id, t.detection.cx) for t in result], [(1, 12)])

    def test_weak_does_not_resurrect_lost_track(self):
        tracker = CentroidTracker(two_stage=True)
        tracker.update([box()])
        tracker.update([])
        self.assertEqual(tracker.update([box(confidence=.15)]), [])

    def test_weak_requires_overlap_and_semantic_agreement(self):
        for candidate in [box(x=25, confidence=.15), box(confidence=.15, team='lujan'),
                          box(confidence=.15, label='ball')]:
            tracker = CentroidTracker(two_stage=True, temporal_teams=True)
            for _ in range(3): tracker.update([box()])
            self.assertEqual(tracker.update([candidate]), [])

    def test_weak_does_not_change_team_votes(self):
        tracker = CentroidTracker(two_stage=True, temporal_teams=True)
        for _ in range(3): tracker.update([box()])
        for _ in range(20):
            result = tracker.update([box(confidence=.15, team=None)])
            self.assertEqual(result[0].detection.team, 'ferro')
        self.assertEqual(len(tracker._team_history[1]), 3)

    def test_high_only_equivalent_with_both_assignment_modes(self):
        assignments = ['greedy']
        try:
            import numpy  # noqa: F401
            import scipy  # noqa: F401
        except ImportError:
            pass
        else:
            assignments.append('global')
        for assignment in assignments:
            old = CentroidTracker(assignment=assignment)
            new = CentroidTracker(assignment=assignment, two_stage=True)
            for x in range(10):
                detections = [box(x), box(100-x, team='lujan')]
                self.assertEqual(old.update(detections), new.update(detections))

    def test_no_duplicate_weak_assignment(self):
        tracker = CentroidTracker(two_stage=True)
        tracker.update([box(), box(x=5)])
        self.assertEqual(len(tracker.update([box(x=2, confidence=.15)])), 1)

    def test_invalid_thresholds(self):
        for options in [dict(low_threshold=.5), dict(high_threshold=1.1),
                        dict(weak_iou=0), dict(low_threshold=float('nan'))]:
            with self.assertRaises(ValueError): CentroidTracker(**options)


if __name__ == '__main__': unittest.main()

class ConfidenceConfigTests(unittest.TestCase):
    def test_detector_rejects_invalid_confidence_before_import(self):
        from sevenmetros_ai.detectors import UltralyticsPersonDetector
        for value in [-.1, 1.1, float('nan'), float('inf')]:
            with self.assertRaises(ValueError):
                UltralyticsPersonDetector(confidence=value)

    def test_detector_rejects_invalid_image_size_before_import(self):
        from sevenmetros_ai.detectors import UltralyticsPersonDetector
        for value in [0, -1, 640.0, '640', True]:
            with self.assertRaises(ValueError):
                UltralyticsPersonDetector(image_size=value)

    def test_existing_high_confidence_cache_rejected_for_low_threshold(self):
        import hashlib
        import json
        from pathlib import Path
        import tempfile
        from unittest.mock import patch
        import run_fixture
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            video = root/'fixture.mp4'
            video.write_bytes(b'fixture sentinel, intentionally not a real video')
            cache = root/'detections.jsonl'
            cache.write_text('[]\n')
            cache.with_suffix('.meta.json').write_text(json.dumps({
                'video_sha256': hashlib.sha256(video.read_bytes()).hexdigest(),
                'model': 'yolo11n.pt', 'confidence': .25}))
            args = ['run_fixture', '--video', str(video), '--cache', str(cache),
                    '--out', str(root/'out'), '--two-stage', '--detector-confidence', '.1']
            with patch('sys.argv', args), patch('run_fixture.CachedDetector') as detector:
                with self.assertRaisesRegex(ValueError, 'Cache source/model mismatch'):
                    run_fixture.main()
                detector.assert_not_called()

    def test_cache_rejected_when_explicit_image_size_differs(self):
        import hashlib
        import json
        from pathlib import Path
        import tempfile
        from unittest.mock import patch
        import run_fixture
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            video = root / 'fixture.mp4'
            video.write_bytes(b'fixture sentinel')
            cache = root / 'detections.jsonl'
            cache.write_text('[]\n')
            cache.with_suffix('.meta.json').write_text(json.dumps({
                'video_sha256': hashlib.sha256(video.read_bytes()).hexdigest(),
                'model': 'yolo11n.pt', 'confidence': .1, 'image_size': 640,
            }))
            args = [
                'run_fixture', '--video', str(video), '--cache', str(cache),
                '--out', str(root / 'out'), '--detector-confidence', '.1',
                '--detector-image-size', '1280',
            ]
            with patch('sys.argv', args), patch('run_fixture.CachedDetector') as detector:
                with self.assertRaisesRegex(ValueError, 'Cache source/model mismatch'):
                    run_fixture.main()
                detector.assert_not_called()

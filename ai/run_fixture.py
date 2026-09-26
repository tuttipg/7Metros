"""Run the real detector once and replay identical detections for comparisons."""
import argparse
from dataclasses import asdict
import hashlib
import json
from pathlib import Path
import time

from sevenmetros_ai.detectors import UltralyticsPersonDetector
from sevenmetros_ai.pipeline import analyze_video
from sevenmetros_ai.tracking import Detection


class CachedDetector:
    def __init__(self, path, model):
        self.replay = path.exists()
        self.stream = path.open('r' if self.replay else 'w')
        self.detector = None if self.replay else UltralyticsPersonDetector(model, device='cpu')

    def detect(self, frame):
        if self.replay:
            line = self.stream.readline()
            if not line:
                raise RuntimeError('Detection cache truncated')
            return [Detection(**d) for d in json.loads(line)]
        detections = self.detector.detect(frame)
        self.stream.write(json.dumps([asdict(d) for d in detections]) + '\n')
        self.stream.flush()
        return detections


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--video', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--cache', required=True)
    p.add_argument('--model', default='yolo11n.pt')
    p.add_argument('--refine', action='store_true')
    p.add_argument('--temporal-teams', action='store_true')
    p.add_argument('--fixture-kits', action='store_true')
    p.add_argument('--velocity-alpha', type=float, default=1.0)
    p.add_argument('--max-missed', type=int, default=8)
    a = p.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    with open(a.video, 'rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    cache = Path(a.cache)
    meta_path = cache.with_suffix('.meta.json')
    expected = {'video_sha256': digest, 'model': a.model, 'confidence': .25}
    if cache.exists() and (not meta_path.exists() or json.loads(meta_path.read_text()) != expected):
        raise ValueError('Cache source/model mismatch')
    if not cache.exists():
        import torch
        torch.set_num_threads(2)
    detector = CachedDetector(cache, a.model)
    classifier = None
    if a.refine:
        from sevenmetros_ai.fixture_filter import BlueCourtClassifier
        classifier = BlueCourtClassifier()
    if a.fixture_kits:
        from sevenmetros_ai.fixture_kits import FerroLujanKits
        classifier = FerroLujanKits()
    started = time.perf_counter()
    try:
        result = analyze_video(a.video, detector, output_jsonl=out/'tracks.jsonl',
                               output_video=out/'annotated.mp4', team_classifier=classifier,
                               temporal_teams=a.temporal_teams, velocity_alpha=a.velocity_alpha,
                               max_missed=a.max_missed)
    finally:
        detector.stream.close()
    if not detector.replay:
        meta_path.write_text(json.dumps(expected))
    result.update(expected)
    result['cache_replay'] = detector.replay
    result['fixture_kits'] = a.fixture_kits
    result['max_missed'] = a.max_missed
    result['wall_seconds'] = time.perf_counter()-started
    (out/'metrics.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()

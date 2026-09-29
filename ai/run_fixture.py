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
    def __init__(self, path, model, confidence=.25, image_size=None):
        self.replay = path.exists()
        self.stream = path.open('r' if self.replay else 'w')
        self.detector = None if self.replay else UltralyticsPersonDetector(
            model, confidence=confidence, device='cpu', image_size=image_size,
        )

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


def _file_sha256(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def _normalize_sha256(value):
    expected = str(value).strip().lower()
    if len(expected) != 64 or any(ch not in '0123456789abcdef' for ch in expected):
        raise ValueError('expected-model-sha256 must be exactly 64 hexadecimal characters')
    return expected


def _verify_model_sha256(model, expected_sha256, *, require_local=True):
    """Verify a local weight file, or trust its recorded hash on cache replay.

    Generation in strict mode always requires the local binary and verifies it
    before inference.  Replay may omit the binary because no model is executed;
    in that case the requested hash is still matched against cache metadata.
    If a local file is supplied during replay it is verified as an extra check.
    """
    if expected_sha256 is None:
        return None
    expected = _normalize_sha256(expected_sha256)
    model_path = Path(model)
    if not model_path.is_file():
        if require_local:
            raise FileNotFoundError(
                'Strict model hash verification requires --model to point to a local weight file for new inference'
            )
        return expected
    actual = _file_sha256(model_path)
    if actual != expected:
        raise ValueError(
            f'Model SHA256 mismatch: expected={expected} actual={actual}'
        )
    return actual


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--video', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--cache', required=True)
    p.add_argument('--model', default='yolo11n.pt')
    p.add_argument('--expected-model-sha256')
    p.add_argument('--refine', action='store_true')
    p.add_argument('--temporal-teams', action='store_true')
    p.add_argument('--fixture-kits', action='store_true')
    p.add_argument('--exclude-confirmed-referees', action='store_true')
    p.add_argument('--velocity-alpha', type=float, default=1.0)
    p.add_argument('--max-missed', type=int, default=8)
    p.add_argument('--assignment', choices=['greedy','global'], default='greedy')
    p.add_argument('--two-stage', action='store_true')
    p.add_argument('--detector-confidence', type=float, default=.25)
    p.add_argument('--detector-image-size', type=int)
    a = p.parse_args()
    if not 0 <= a.detector_confidence <= 1:
        p.error('detector-confidence must be in [0,1]')
    if a.two_stage and a.detector_confidence > .10:
        p.error('two-stage requires --detector-confidence 0.10 or lower and a matching new cache')
    if a.detector_image_size is not None and a.detector_image_size <= 0:
        p.error('detector-image-size must be positive')
    if a.exclude_confirmed_referees and not (a.fixture_kits and a.temporal_teams):
        p.error('--exclude-confirmed-referees requires --fixture-kits and --temporal-teams')

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    digest = _file_sha256(a.video)
    cache = Path(a.cache)
    meta_path = cache.with_suffix('.meta.json')
    model_sha256 = _verify_model_sha256(
        a.model,
        a.expected_model_sha256,
        require_local=not cache.exists(),
    )
    # In strict mode the portable identity of the model is basename + SHA, not
    # the machine-specific absolute path used to locate the same weight file.
    model_identity = Path(a.model).name if model_sha256 is not None else a.model
    expected = {
        'video_sha256': digest,
        'model': model_identity,
        'confidence': a.detector_confidence,
    }
    if model_sha256 is not None:
        expected['model_sha256'] = model_sha256
    if a.detector_image_size is not None:
        expected['image_size'] = a.detector_image_size
    if cache.exists() and (not meta_path.exists() or json.loads(meta_path.read_text()) != expected):
        raise ValueError('Cache source/model mismatch')
    if not cache.exists():
        import torch
        torch.set_num_threads(2)
    detector = CachedDetector(
        cache, a.model, a.detector_confidence, a.detector_image_size,
    )
    classifier = None
    if a.refine:
        from sevenmetros_ai.fixture_filter import BlueCourtClassifier
        classifier = BlueCourtClassifier()
    if a.fixture_kits:
        from sevenmetros_ai.fixture_kits import FerroLujanKits
        classifier = FerroLujanKits(allow_boundary_roles=a.exclude_confirmed_referees)
    started = time.perf_counter()
    try:
        result = analyze_video(a.video, detector, output_jsonl=out/'tracks.jsonl',
                               output_video=out/'annotated.mp4', team_classifier=classifier,
                               temporal_teams=a.temporal_teams, velocity_alpha=a.velocity_alpha,
                               max_missed=a.max_missed, assignment=a.assignment, two_stage=a.two_stage,
                               exclude_confirmed_referees=a.exclude_confirmed_referees)
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

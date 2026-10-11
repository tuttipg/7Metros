"""Reproduce the weak-detection regression and optional high-confidence cache parity.

No model inference, image decoding, or accuracy estimation is performed.
"""
import argparse
from dataclasses import asdict
import hashlib
import json
from pathlib import Path
from sevenmetros_ai.tracking import CentroidTracker, Detection


def compare(cache=None):
    baseline = CentroidTracker(max_missed=1)
    candidate = CentroidTracker(max_missed=1, two_stage=True)
    old_ids, new_ids = [], []
    for confidence in [.9, .15, .15, .15, .9]:
        detections = [Detection(0, 0, 20, 40, confidence)]
        old_ids.extend(t.track_id for t in baseline.update([d for d in detections if d.confidence >= .25]))
        new_ids.extend(t.track_id for t in candidate.update(detections))
    result = {'synthetic': {'frames': 5, 'ground_truth_people': 1,
              'baseline_observations': len(old_ids), 'candidate_observations': len(new_ids),
              'baseline_ids': len(set(old_ids)), 'candidate_ids': len(set(new_ids))},
              'real_accuracy': None, 'neural_inference_executed': False}
    if cache:
        baseline, candidate = CentroidTracker(), CentroidTracker(two_stage=True)
        frames = observations = 0
        digest = hashlib.sha256()
        with Path(cache).open('rb') as source:
            for line in source:
                digest.update(line)
                detections = [Detection(**d) for d in json.loads(line)]
                if any(not .25 <= d.confidence <= 1 for d in detections):
                    raise ValueError('Parity check requires only finite high-confidence detections')
                old, new = baseline.update(detections), candidate.update(detections)
                if [asdict(t) for t in old] != [asdict(t) for t in new]:
                    raise AssertionError(f'High-confidence parity failed at frame {frames}')
                frames += 1
                observations += len(old)
        result['cache_parity'] = {'frames': frames, 'observations': observations,
                                 'identical': True, 'sha256': digest.hexdigest(),
                                 'scope': 'raw boxes only; no court/team classification; not accuracy'}
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache')
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    result = compare(args.cache)
    Path(args.out).write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result, indent=2))

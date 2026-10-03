"""Require an interpolation candidate to improve every reviewed GT sequence.

Inputs are compact JSON outputs from evaluate_trackeval_bundle.py.  This is a
promotion guardrail, not an evaluator: TrackEval must already have succeeded.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


METRICS = ('HOTA', 'IDF1', 'MOTA', 'TP', 'FN', 'FP', 'IDSW', 'fragments')


def parse_spec(value):
    if '=' not in value:
        raise argparse.ArgumentTypeError('Use LABEL=PATH')
    label, path = value.split('=', 1)
    if not label.strip() or not path.strip():
        raise argparse.ArgumentTypeError('Label and path must be nonempty')
    return label.strip(), Path(path.strip())


def _metric_payload(path, tracker):
    payload = json.loads(Path(path).read_text(encoding='utf-8'))
    if payload.get('status') != 'OFFICIAL_TRACKEVAL_ON_HUMAN_REVIEWED_GT':
        raise ValueError(f'Unexpected TrackEval status: {path}')
    try:
        metrics = payload['metrics_percent_except_counts'][tracker]
    except (KeyError, TypeError) as exc:
        raise ValueError(f'Missing tracker {tracker}: {path}') from exc
    if any(key not in metrics or not math.isfinite(float(metrics[key])) for key in METRICS):
        raise ValueError(f'Missing or invalid metric for {tracker}: {path}')
    return payload['scope']['sequence'], metrics


def validate(control_specs, candidate_specs, tracker, *, epsilon=1e-6):
    controls, candidates = dict(control_specs), dict(candidate_specs)
    if (not controls or len(controls) != len(control_specs) or
            len(candidates) != len(candidate_specs) or
            controls.keys() != candidates.keys()):
        raise ValueError('Control/candidate labels must be present, unique and equal')
    sequences = {}
    all_safe = True
    for label in controls:
        control_sequence, control = _metric_payload(controls[label], tracker)
        candidate_sequence, candidate = _metric_payload(candidates[label], tracker)
        if control_sequence != candidate_sequence:
            raise ValueError(f'Sequence mismatch for {label}')
        delta = {key: candidate[key] - control[key] for key in METRICS}
        safe = (
            delta['HOTA'] >= -epsilon and
            delta['IDF1'] >= -epsilon and
            delta['IDSW'] <= 0 and
            delta['fragments'] <= 0
        )
        all_safe &= safe
        sequences[label] = {
            'sequence': control_sequence,
            'safe': safe,
            'control': {key: control[key] for key in METRICS},
            'candidate': {key: candidate[key] for key in METRICS},
            'delta': delta,
        }
    return {
        'status': (
            'INTERPOLATION_POLICY_VERIFIED_ACROSS_REVIEWED_GT'
            if all_safe else 'INTERPOLATION_POLICY_REJECTED'
        ),
        'tracker': tracker,
        'requirements': {
            'HOTA_delta_min': 0, 'IDF1_delta_min': 0,
            'IDSW_delta_max': 0, 'fragments_delta_max': 0,
        },
        'sequences': sequences,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--control', dest='control_specs', action='append',
                        type=parse_spec, required=True)
    parser.add_argument('--candidate', dest='candidate_specs', action='append',
                        type=parse_spec, required=True)
    parser.add_argument('--tracker', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    result = validate(args.control_specs, args.candidate_specs, args.tracker)
    output = Path(args.output)
    if output.exists():
        raise ValueError(f'Output already exists: {output}')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()

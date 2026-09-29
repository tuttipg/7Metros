"""Evaluate a retained tracker A/B experiment on human GT with TrackEval.

Consumes `experiment_manifest.json` from run_tracker_ab_experiment.py.  It never
needs the full 3,600-frame JSONL again: only the retained slices are used to
build TrackEval bundles for each reviewed annotation task.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

from evaluate_trackeval_bundle import evaluate
from prepare_trackeval_bundle import build, validate_review, read_frames
from validate_mot_candidate import validate as validate_candidate


TRACKER_NAMES = ('baseline_high_only', 'two_stage', 'bytetrack_standard')


def parse_task_spec(value):
    if '=' not in value:
        raise argparse.ArgumentTypeError('Use LABEL=TASK_DIRECTORY')
    label, path = value.split('=', 1)
    label, path = label.strip(), path.strip()
    if not label or not path:
        raise argparse.ArgumentTypeError('Task label/path must be nonempty')
    if any(ch not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-' for ch in label):
        raise argparse.ArgumentTypeError('Task label must be filesystem-safe')
    return label, Path(path)


def _sha256(path: Path) -> str:
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def _require_empty_output(path: Path):
    if path.exists() and any(path.iterdir()):
        raise ValueError(f'Output directory is not empty: {path}')
    path.mkdir(parents=True, exist_ok=True)


def _source_frames(task: Path) -> list[int]:
    manifest, _ = validate_review(task)
    mapping = read_frames(task, int(manifest['task_frames']))
    return [source for _, source in mapping]


def _slice_for(experiment_root, run_info, tracker, source_frames):
    slices = run_info.get('retained_slices', {}).get(tracker, [])
    if not slices:
        raise ValueError(f'No retained slices for {tracker}')
    first, last = min(source_frames), max(source_frames)
    matches = [
        item for item in slices
        if int(item['start_frame']) <= first
        and int(item['end_frame_exclusive']) > last
    ]
    if len(matches) != 1:
        raise ValueError(
            f'Expected exactly one retained slice covering {first}:{last + 1} for {tracker}'
        )
    item = matches[0]
    run_label = run_info['label']
    path = (
        Path(experiment_root) / run_label / 'retained_gt_ranges' /
        f"{tracker}__frames_{item['start_frame']}_{item['end_frame_exclusive']}.jsonl"
    )
    if not path.is_file():
        raise FileNotFoundError(path)
    if _sha256(path) != item.get('sha256'):
        raise ValueError(f'Retained slice hash mismatch: {path}')
    return path


def run_evaluation(
    experiment_manifest,
    task_specs,
    output_dir,
    *,
    tracker='two_stage',
    trackeval_module=None,
):
    experiment_manifest = Path(experiment_manifest)
    experiment_root = experiment_manifest.parent
    payload = json.loads(experiment_manifest.read_text(encoding='utf-8'))
    if payload.get('schema') != '7metros-ai.tracker-ab-experiment.v1':
        raise ValueError('Unexpected experiment manifest schema')
    if payload.get('status') != 'TRACKER_AB_REPLAY_WITH_RETAINED_GT_SLICES':
        raise ValueError('Unexpected experiment status')
    if tracker not in TRACKER_NAMES:
        raise ValueError(f'Unsupported tracker: {tracker}')

    tasks = dict(task_specs)
    if not tasks or len(tasks) != len(task_specs):
        raise ValueError('Task labels must be present and unique')
    for label, task in tasks.items():
        if not Path(task).is_dir():
            raise FileNotFoundError(task)

    output_dir = Path(output_dir)
    _require_empty_output(output_dir)
    evaluations = {'control': {}, 'candidate': {}}

    for run_key in ('control', 'candidate'):
        try:
            run_info = payload['runs'][run_key]
        except (KeyError, TypeError) as exc:
            raise ValueError(f'Missing experiment run: {run_key}') from exc
        for task_label, task in tasks.items():
            task = Path(task)
            source_frames = _source_frames(task)
            track_specs = [
                (
                    tracker_name,
                    _slice_for(
                        experiment_root, run_info, tracker_name, source_frames
                    ),
                )
                for tracker_name in TRACKER_NAMES
            ]
            target = output_dir / run_key / task_label
            bundle_dir = target / 'bundle'
            build(task, track_specs, bundle_dir)
            result_path = target / 'trackeval.json'
            evaluate(
                bundle_dir,
                result_path,
                trackeval_module=trackeval_module,
            )
            evaluations[run_key][task_label] = {
                'trackeval_path': str(result_path),
                'trackeval_sha256': _sha256(result_path),
                'bundle_manifest_sha256': _sha256(bundle_dir / 'bundle_manifest.json'),
            }

    control_specs = [
        (label, Path(evaluations['control'][label]['trackeval_path']))
        for label in tasks
    ]
    candidate_specs = [
        (label, Path(evaluations['candidate'][label]['trackeval_path']))
        for label in tasks
    ]
    guardrail = validate_candidate(control_specs, candidate_specs, tracker)
    guardrail_path = output_dir / 'candidate_guardrail.json'
    guardrail_path.write_text(json.dumps(guardrail, indent=2) + '\n', encoding='utf-8')

    result = {
        'schema': '7metros-ai.tracker-ab-evaluation.v1',
        'status': 'TRACKER_AB_OFFICIAL_TRACKEVAL_COMPLETE',
        'experiment_manifest': str(experiment_manifest),
        'experiment_manifest_sha256': _sha256(experiment_manifest),
        'tracker_under_test': tracker,
        'tasks': {label: str(path) for label, path in tasks.items()},
        'evaluations': evaluations,
        'guardrail': guardrail,
        'guardrail_path': str(guardrail_path),
        'guardrail_sha256': _sha256(guardrail_path),
    }
    result_path = output_dir / 'evaluation_manifest.json'
    result_path.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    result['manifest_path'] = str(result_path)
    result['manifest_sha256'] = _sha256(result_path)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--experiment-manifest', required=True)
    parser.add_argument('--task', dest='task_specs', action='append',
                        type=parse_task_spec, required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--tracker', default='two_stage')
    args = parser.parse_args()
    result = run_evaluation(
        args.experiment_manifest,
        args.task_specs,
        args.output,
        tracker=args.tracker,
    )
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()

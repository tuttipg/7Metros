"""Run official TrackEval metrics on a bundle made by prepare_trackeval_bundle.

The compact JSON output preserves hashes and explicitly identifies this as an
evaluation of persisted tracker replay, not a fresh detector inference run.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from prepare_mot_annotation import ensure_new_output, sha256_file


DATASET_NAME = 'MotChallenge2DBox'
CLASS_NAME = 'pedestrian'
SEQUENCE = 'ferro_lujan_contact'


def percentage(value):
    return round(float(value) * 100, 6)


def mean_percentage(values):
    values = list(values)
    if not values:
        raise ValueError('TrackEval returned an empty metric vector')
    return percentage(sum(float(value) for value in values) / len(values))


def compact_tracker_metrics(payload):
    hota = payload['HOTA']
    clear = payload['CLEAR']
    identity = payload['Identity']
    count = payload['Count']
    return {
        'HOTA': mean_percentage(hota['HOTA']),
        'DetA': mean_percentage(hota['DetA']),
        'AssA': mean_percentage(hota['AssA']),
        'LocA': mean_percentage(hota['LocA']),
        'MOTA': percentage(clear['MOTA']),
        'MOTP': percentage(clear['MOTP']),
        'recall': percentage(clear['CLR_Re']),
        'precision': percentage(clear['CLR_Pr']),
        'IDF1': percentage(identity['IDF1']),
        'IDR': percentage(identity['IDR']),
        'IDP': percentage(identity['IDP']),
        'TP': int(clear['CLR_TP']),
        'FN': int(clear['CLR_FN']),
        'FP': int(clear['CLR_FP']),
        'IDSW': int(clear['IDSW']),
        'fragments': int(clear['Frag']),
        'detections': int(count['Dets']),
        'gt_detections': int(count['GT_Dets']),
        'tracker_ids': int(count['IDs']),
        'gt_ids': int(count['GT_IDs']),
    }


def summarize_results(results, tracker_labels):
    try:
        dataset = results[DATASET_NAME]
        return {
            label: compact_tracker_metrics(
                dataset[label]['COMBINED_SEQ'][CLASS_NAME]
            )
            for label in tracker_labels
        }
    except (KeyError, TypeError) as exc:
        raise ValueError('Unexpected TrackEval result structure') from exc


def validate_bundle(bundle):
    bundle = Path(bundle)
    manifest_path = bundle / 'bundle_manifest.json'
    if not manifest_path.is_file():
        raise ValueError('Missing bundle_manifest.json')
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    if manifest.get('status') != (
        'STRUCTURALLY_VALID_REVIEW_ATTESTATION_NOT_ACCURACY_PROOF'
    ):
        raise ValueError('Unexpected bundle status')
    if manifest.get('sequence') != SEQUENCE or manifest.get('dataset') != '7metros-train':
        raise ValueError('Unexpected bundle sequence or dataset')
    gt_path = (
        bundle / 'gt' / 'mot_challenge' / '7metros-train' / SEQUENCE /
        'gt' / 'gt.txt'
    )
    if sha256_file(gt_path) != manifest.get('gt_sha256'):
        raise ValueError('Ground-truth hash differs from bundle manifest')
    labels = list(manifest.get('trackers', {}))
    if not labels:
        raise ValueError('Bundle contains no trackers')
    for label in labels:
        tracker_path = (
            bundle / 'trackers' / 'mot_challenge' / '7metros-train' /
            label / 'data' / f'{SEQUENCE}.txt'
        )
        expected = manifest['trackers'][label].get('mot_sha256')
        if sha256_file(tracker_path) != expected:
            raise ValueError(f'Tracker hash differs from bundle manifest: {label}')
    return manifest, labels


def evaluate(bundle, output, *, trackeval_module=None):
    bundle, output = Path(bundle), Path(output)
    manifest, labels = validate_bundle(bundle)
    results_dir = ensure_new_output(output.parent / f'{output.stem}_files')
    if output.exists():
        raise ValueError(f'Output file already exists: {output}')
    if trackeval_module is None:
        try:
            import trackeval as trackeval_module
        except ImportError as exc:
            raise RuntimeError(
                'TrackEval is required; install the evaluation optional dependency'
            ) from exc

    eval_config = trackeval_module.Evaluator.get_default_eval_config()
    eval_config.update({
        'USE_PARALLEL': False, 'NUM_PARALLEL_CORES': 1,
        'BREAK_ON_ERROR': True, 'PRINT_RESULTS': True,
        'PRINT_ONLY_COMBINED': False, 'PRINT_CONFIG': False,
        'TIME_PROGRESS': False, 'OUTPUT_SUMMARY': True,
        'OUTPUT_DETAILED': True, 'PLOT_CURVES': False,
        'DISPLAY_LESS_PROGRESS': True,
    })
    dataset_config = (
        trackeval_module.datasets.MotChallenge2DBox.get_default_dataset_config()
    )
    dataset_config.update({
        'GT_FOLDER': str(bundle / 'gt' / 'mot_challenge'),
        'TRACKERS_FOLDER': str(bundle / 'trackers' / 'mot_challenge'),
        'OUTPUT_FOLDER': str(results_dir),
        'TRACKERS_TO_EVAL': labels,
        'CLASSES_TO_EVAL': [CLASS_NAME],
        'BENCHMARK': '7metros', 'SPLIT_TO_EVAL': 'train',
        'INPUT_AS_ZIP': False, 'PRINT_CONFIG': False, 'DO_PREPROC': False,
        'TRACKER_SUB_FOLDER': 'data', 'OUTPUT_SUB_FOLDER': '',
        'SEQMAP_FILE': str(
            bundle / 'gt' / 'mot_challenge' / 'seqmaps' / '7metros-train.txt'
        ),
    })
    metrics_config = {
        'METRICS': ['HOTA', 'CLEAR', 'Identity'],
        'THRESHOLD': 0.5, 'PRINT_CONFIG': False,
    }
    evaluator = trackeval_module.Evaluator(eval_config)
    dataset = trackeval_module.datasets.MotChallenge2DBox(dataset_config)
    metrics = [
        trackeval_module.metrics.HOTA(metrics_config),
        trackeval_module.metrics.CLEAR(metrics_config),
        trackeval_module.metrics.Identity(metrics_config),
    ]
    raw_results, messages = evaluator.evaluate([dataset], metrics)
    failures = {
        label: message for label, message in messages.get(DATASET_NAME, {}).items()
        if message != 'Success'
    }
    if failures:
        raise RuntimeError(f'TrackEval failed: {failures}')
    result = {
        'status': 'OFFICIAL_TRACKEVAL_ON_HUMAN_REVIEWED_GT',
        'scope': {
            'source': 'persisted_inference_cache_tracker_replay',
            'fresh_inference': False,
            'frames': manifest['frames'],
            'sequence': SEQUENCE,
            'iou_threshold': 0.5,
            'preprocessing': False,
        },
        'trackeval_version': str(getattr(trackeval_module, '__version__', 'unknown')),
        'bundle_manifest_sha256': sha256_file(bundle / 'bundle_manifest.json'),
        'gt_sha256': manifest['gt_sha256'],
        'metrics_percent_except_counts': summarize_results(raw_results, labels),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', required=True)
    parser.add_argument('--output', required=True)
    print(json.dumps(evaluate(**vars(parser.parse_args())), indent=2))


if __name__ == '__main__':
    main()

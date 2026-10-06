"""Run a control/candidate MOT replay and retain evaluable GT slices immediately.

This wrapper exists because full 3,600-frame tracker JSONL files are intentionally
not versioned.  A benchmark used for a MOT decision must not finish without also
persisting the compact frame ranges needed by the reviewed ground truths.

The candidate currently exposed is the opt-in ambiguous-velocity guard.  This
script does not run TrackEval or promote a tracker; it only creates a reproducible
A/B replay package with hashes and retained slices.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import benchmark_trackers
from sevenmetros_ai.evidence_slices import parse_frame_range, retain_tracking_slices


DEFAULT_GT_RANGES = ((105, 210), (2915, 3005))
TRACKER_NAMES = ("baseline_high_only", "two_stage", "bytetrack_standard")


def _sha256(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def _require_empty_output(path: Path) -> None:
    if path.exists() and any(path.iterdir()):
        raise ValueError(f"Output directory is not empty: {path}")
    path.mkdir(parents=True, exist_ok=True)


def _run_variant(
    *,
    label: str,
    video: Path,
    cache: Path,
    root: Path,
    ranges: tuple[tuple[int, int], ...],
    max_frames: int | None,
    exclude_confirmed_referees: bool,
    freeze_ambiguous_velocity: bool,
    ambiguity_iou: float,
) -> dict:
    output_dir = root / label
    result = benchmark_trackers.compare(
        video,
        cache,
        output_dir,
        max_frames=max_frames,
        exclude_confirmed_referees=exclude_confirmed_referees,
        freeze_ambiguous_velocity=freeze_ambiguous_velocity,
        ambiguity_iou=ambiguity_iou,
    )

    tracker_paths = {}
    for tracker_name in TRACKER_NAMES:
        try:
            tracker_path = Path(result["trackers"][tracker_name]["output_jsonl"])
        except (KeyError, TypeError) as exc:
            raise ValueError(
                f"Benchmark did not return output JSONL for {tracker_name}"
            ) from exc
        if not tracker_path.is_file():
            raise FileNotFoundError(tracker_path)
        tracker_paths[tracker_name] = tracker_path

    retained_dir = output_dir / "retained_gt_ranges"
    retained = retain_tracking_slices(tracker_paths, ranges, retained_dir)
    comparison_path = output_dir / "comparison.json"
    if not comparison_path.is_file():
        raise FileNotFoundError(comparison_path)

    return {
        "label": label,
        "experimental_ambiguous_velocity_guard": bool(freeze_ambiguous_velocity),
        "comparison_path": str(comparison_path),
        "comparison_sha256": _sha256(comparison_path),
        "retained_manifest_path": retained["manifest_path"],
        "retained_manifest_sha256": retained["manifest_sha256"],
        "tracker_source_sha256": {
            name: retained["trackers"][name]["source_sha256"]
            for name in TRACKER_NAMES
        },
        "retained_slices": {
            name: retained["trackers"][name]["slices"]
            for name in TRACKER_NAMES
        },
    }


def run_experiment(
    video,
    cache,
    output_dir,
    *,
    ranges=DEFAULT_GT_RANGES,
    max_frames=None,
    exclude_confirmed_referees=False,
    ambiguity_iou=.30,
) -> dict:
    video = Path(video)
    cache = Path(cache)
    output_dir = Path(output_dir)
    if not video.is_file():
        raise FileNotFoundError(video)
    if not cache.is_file():
        raise FileNotFoundError(cache)
    meta_path = cache.with_suffix(".meta.json")
    if not meta_path.is_file():
        raise FileNotFoundError(meta_path)
    if max_frames is not None and max_frames <= 0:
        raise ValueError("max_frames must be positive")
    if not 0 < float(ambiguity_iou) <= 1:
        raise ValueError("ambiguity_iou must be in (0,1]")

    normalized_ranges = tuple(sorted(set(tuple(item) for item in ranges)))
    if not normalized_ranges:
        raise ValueError("At least one retained frame range is required")
    # Reuse the shared parser semantics for explicit validation.
    normalized_ranges = tuple(
        parse_frame_range(f"{start}:{end}") for start, end in normalized_ranges
    )
    if max_frames is not None and any(end > max_frames for _, end in normalized_ranges):
        raise ValueError("max_frames does not cover all retained frame ranges")

    _require_empty_output(output_dir)
    control = _run_variant(
        label="control",
        video=video,
        cache=cache,
        root=output_dir,
        ranges=normalized_ranges,
        max_frames=max_frames,
        exclude_confirmed_referees=exclude_confirmed_referees,
        freeze_ambiguous_velocity=False,
        ambiguity_iou=ambiguity_iou,
    )
    candidate = _run_variant(
        label="ambiguous_velocity_guard",
        video=video,
        cache=cache,
        root=output_dir,
        ranges=normalized_ranges,
        max_frames=max_frames,
        exclude_confirmed_referees=exclude_confirmed_referees,
        freeze_ambiguous_velocity=True,
        ambiguity_iou=ambiguity_iou,
    )

    manifest = {
        "schema": "7metros-ai.tracker-ab-experiment.v1",
        "status": "TRACKER_AB_REPLAY_WITH_RETAINED_GT_SLICES",
        "accuracy_status": "TRACKING_OUTPUTS_ONLY_TRACK_EVAL_REQUIRED",
        "inputs": {
            "video": str(video),
            "video_sha256": _sha256(video),
            "cache": str(cache),
            "cache_sha256": _sha256(cache),
            "cache_meta": str(meta_path),
            "cache_meta_sha256": _sha256(meta_path),
        },
        "settings": {
            "ranges_start_inclusive_end_exclusive": [list(item) for item in normalized_ranges],
            "max_frames": max_frames,
            "exclude_confirmed_referees": bool(exclude_confirmed_referees),
            "candidate": "ambiguous_velocity_guard",
            "ambiguity_iou": float(ambiguity_iou),
            "byte_track_changed_between_runs": False,
        },
        "runs": {
            "control": control,
            "candidate": candidate,
        },
        "next_step": (
            "Prepare TrackEval bundles for both retained GT ranges and require "
            "HOTA/IDF1 non-regression with no IDSW/fragmentation increase per sequence."
        ),
    }
    manifest_path = output_dir / "experiment_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    manifest["manifest_path"] = str(manifest_path)
    manifest["manifest_sha256"] = _sha256(manifest_path)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True)
    parser.add_argument("--cache", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument(
        "--range",
        dest="ranges",
        action="append",
        type=parse_frame_range,
        help=(
            "START:END end-exclusive range to retain. Repeat for several ranges. "
            "Defaults to current GT1 and GT2 ranges."
        ),
    )
    parser.add_argument("--max-frames", type=int)
    parser.add_argument("--exclude-confirmed-referees", action="store_true")
    parser.add_argument("--ambiguity-iou", type=float, default=.30)
    args = parser.parse_args()
    result = run_experiment(
        args.video,
        args.cache,
        args.output,
        ranges=args.ranges or DEFAULT_GT_RANGES,
        max_frames=args.max_frames,
        exclude_confirmed_referees=args.exclude_confirmed_referees,
        ambiguity_iou=args.ambiguity_iou,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

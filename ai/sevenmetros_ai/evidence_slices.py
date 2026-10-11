from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Iterable, Mapping


def parse_frame_range(value: str) -> tuple[int, int]:
    """Parse START:END using an end-exclusive frame interval."""
    try:
        left, right = value.split(":", 1)
        start, end = int(left), int(right)
    except (ValueError, AttributeError) as exc:
        raise ValueError("Frame range must use START:END integers") from exc
    if start < 0 or end <= start:
        raise ValueError("Frame range must satisfy 0 <= START < END")
    return start, end


def _sha256(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def _validate_ranges(ranges: Iterable[tuple[int, int]]) -> list[tuple[int, int]]:
    normalized = sorted(set(ranges))
    if not normalized:
        raise ValueError("At least one frame range is required")
    previous_end = None
    for start, end in normalized:
        if start < 0 or end <= start:
            raise ValueError("Invalid frame range")
        if previous_end is not None and start < previous_end:
            raise ValueError("Retained frame ranges must not overlap")
        previous_end = end
    return normalized


def _load_rows(path: Path) -> dict[int, dict]:
    rows: dict[int, dict] = {}
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON in {path} line {line_number}") from exc
        if row.get("schema") != "7metros-ai.v1":
            raise ValueError(f"Unsupported schema in {path} line {line_number}")
        frame = row.get("frame_index")
        if not isinstance(frame, int) or frame < 0:
            raise ValueError(f"Invalid frame_index in {path} line {line_number}")
        if frame in rows:
            raise ValueError(f"Duplicate frame {frame} in {path}")
        if not isinstance(row.get("objects"), list):
            raise ValueError(f"objects must be a list in {path} frame {frame}")
        rows[frame] = row
    if not rows:
        raise ValueError(f"Tracking file is empty: {path}")
    return rows


def retain_tracking_slices(
    trackers: Mapping[str, Path | str],
    ranges: Iterable[tuple[int, int]],
    output_dir: Path | str,
) -> dict:
    """Persist compact, hashed JSONL slices needed for later MOT evaluation.

    Frame numbers are preserved exactly. The function fails closed if any
    requested frame is missing or if an output path already exists.
    """
    if not trackers:
        raise ValueError("At least one tracker input is required")
    normalized_ranges = _validate_ranges(ranges)
    destination = Path(output_dir)
    if destination.exists() and any(destination.iterdir()):
        raise ValueError(f"Output directory is not empty: {destination}")
    destination.mkdir(parents=True, exist_ok=True)

    manifest = {
        "schema": "7metros-ai.evidence-slices.v1",
        "range_semantics": "start_inclusive_end_exclusive",
        "ranges": [[start, end] for start, end in normalized_ranges],
        "trackers": {},
    }

    for raw_name, raw_path in sorted(trackers.items()):
        name = str(raw_name).strip()
        if not name or any(character not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-" for character in name):
            raise ValueError(f"Unsafe tracker name: {raw_name!r}")
        source = Path(raw_path)
        if not source.is_file():
            raise FileNotFoundError(source)
        rows = _load_rows(source)
        tracker_manifest = {
            "source": str(source),
            "source_sha256": _sha256(source),
            "slices": [],
        }

        for start, end in normalized_ranges:
            expected = list(range(start, end))
            missing = [frame for frame in expected if frame not in rows]
            if missing:
                raise ValueError(
                    f"Tracker {name} is missing {len(missing)} requested frames; first={missing[:5]}"
                )
            slice_path = destination / f"{name}__frames_{start}_{end}.jsonl"
            if slice_path.exists():
                raise ValueError(f"Refusing to overwrite {slice_path}")
            observations = 0
            track_ids = set()
            with slice_path.open("w", encoding="utf-8") as stream:
                for frame in expected:
                    row = rows[frame]
                    objects = row["objects"]
                    observations += len(objects)
                    track_ids.update(obj.get("track_id") for obj in objects)
                    stream.write(json.dumps(row, separators=(",", ":")) + "\n")
            tracker_manifest["slices"].append({
                "start_frame": start,
                "end_frame_exclusive": end,
                "frames": end - start,
                "observations": observations,
                "track_ids": len(track_ids),
                "path": str(slice_path),
                "sha256": _sha256(slice_path),
            })
        manifest["trackers"][name] = tracker_manifest

    manifest_path = destination / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    manifest["manifest_path"] = str(manifest_path)
    manifest["manifest_sha256"] = _sha256(manifest_path)
    return manifest

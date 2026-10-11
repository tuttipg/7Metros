"""Fail-closed validation for a single-class YOLO ball training dataset."""
from __future__ import annotations

import hashlib
import json
import math
import re
import unicodedata
from pathlib import Path

from .ball_ground_truth import sha256_file
from .ball_holdout import (
    DHASH64_MAX_DISTANCE,
    PHASH64_MAX_DISTANCE,
    PERCEPTUAL_SCHEMA,
    SCHEMA as HOLDOUT_SCHEMA,
    perceptual_hashes,
    pixel_sha256,
)


SCHEMA = "sevenmetros.ball-training-dataset-validation/v1"
REJECTION_SCHEMA = "sevenmetros.ball-training-dataset-rejection/v1"
REJECTED_STATUS = "REJECTED_BALL_TRAINING_DATASET"
STATUS = "STRUCTURALLY_VALID_AND_HOLDOUT_EXCLUDED_NOT_MODEL_ACCURACY"
PERCEPTUAL_STATUS = "STRUCTURALLY_VALID_AND_HOLDOUT_EXCLUDED_EXACT_AND_PERCEPTUAL_NOT_MODEL_ACCURACY"
IMAGE_SUFFIXES = {".bmp", ".jpeg", ".jpg", ".png", ".webp"}
BALL_NAMES = {"ball", "ballon", "balon", "pelota", "handball"}
HEX_SHA256 = re.compile(r"^[0-9a-f]{64}$")
HEX64 = re.compile(r"^[0-9a-f]{16}$")
# Roboflow exports can place an edge a few millionths beyond 1.0 after decimal
# serialization. This is far below one pixel at normal video resolutions.
YOLO_BOUNDARY_EPSILON = 1e-5


def _canonical_ball_name(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError("class name must be a non-empty string")
    normalized = unicodedata.normalize("NFKD", value.strip().lower())
    return "".join(character for character in normalized if not unicodedata.combining(character))


def _validate_class_schema(config):
    names = config.get("names")
    if isinstance(names, list):
        if len(names) != 1:
            raise ValueError("dataset must declare exactly one class")
        name = names[0]
    elif isinstance(names, dict):
        if len(names) != 1 or not ({0, "0"} & set(names)):
            raise ValueError("dataset must declare exactly class id 0")
        name = names[0] if 0 in names else names["0"]
    else:
        raise ValueError("names must be a one-item list or id-to-name mapping")
    nc = config.get("nc", 1)
    if isinstance(nc, bool) or nc != 1:
        raise ValueError("nc must equal 1")
    canonical = _canonical_ball_name(name)
    if canonical not in BALL_NAMES:
        raise ValueError(f"class 0 must name a ball, got {name!r}")
    return str(name)


def _resolve_split(dataset_root, value, split):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{split} must be one local directory")
    if "://" in value or any(character in value for character in "*?[]"):
        raise ValueError(f"{split} must be one local directory without globs")
    path = Path(value)
    if not path.is_absolute():
        path = dataset_root / path
    path = path.resolve()
    try:
        path.relative_to(dataset_root)
    except ValueError as exc:
        raise ValueError(f"{split} escapes dataset root") from exc
    if not path.is_dir():
        raise ValueError(f"{split} directory does not exist: {path}")
    return path


def _label_root(image_root):
    if image_root.name == "images":
        return image_root.parent / "labels"
    if image_root.parent.name == "images":
        return image_root.parent.parent / "labels" / image_root.name
    raise ValueError(f"cannot derive labels directory from {image_root}")


def _label_path(image_path, image_root, label_root):
    return label_root / image_path.relative_to(image_root).with_suffix(".txt")


def _parse_label(path):
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError as exc:
        raise ValueError(f"label is not UTF-8: {path}") from exc
    boxes = []
    for line_number, line in enumerate(lines, 1):
        if not line.strip():
            continue
        fields = line.split()
        if len(fields) != 5:
            raise ValueError(f"{path}:{line_number}: expected 5 YOLO fields")
        if fields[0] != "0":
            raise ValueError(f"{path}:{line_number}: class id must be integer 0")
        try:
            x, y, width, height = (float(value) for value in fields[1:])
        except ValueError as exc:
            raise ValueError(f"{path}:{line_number}: coordinates must be numeric") from exc
        values = (x, y, width, height)
        if not all(math.isfinite(value) for value in values):
            raise ValueError(f"{path}:{line_number}: coordinates must be finite")
        if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
            raise ValueError(f"{path}:{line_number}: center must be normalized")
        if not (0.0 < width <= 1.0 and 0.0 < height <= 1.0):
            raise ValueError(f"{path}:{line_number}: size must be normalized and positive")
        if (
            x - width / 2 < -YOLO_BOUNDARY_EPSILON
            or x + width / 2 > 1 + YOLO_BOUNDARY_EPSILON
            or y - height / 2 < -YOLO_BOUNDARY_EPSILON
            or y + height / 2 > 1 + YOLO_BOUNDARY_EPSILON
        ):
            raise ValueError(f"{path}:{line_number}: box extends outside the image")
        boxes.append(values)
    return boxes


def _holdout_contract(payload):
    if not isinstance(payload, dict) or payload.get("schema_version") not in {
        HOLDOUT_SCHEMA, PERCEPTUAL_SCHEMA,
    }:
        raise ValueError(
            f"holdout manifest schema must be {HOLDOUT_SCHEMA} or {PERCEPTUAL_SCHEMA}"
        )
    perceptual_mode = payload["schema_version"] == PERCEPTUAL_SCHEMA
    if perceptual_mode:
        match = payload.get("perceptual_match")
        if not isinstance(match, dict) or (
            match.get("logic") != "dhash64_distance_lte_AND_phash64_distance_lte"
            or match.get("dhash64_max_hamming") != DHASH64_MAX_DISTANCE
            or match.get("phash64_max_hamming") != PHASH64_MAX_DISTANCE
        ):
            raise ValueError("perceptual holdout thresholds differ from the validated contract")
    frames = payload.get("frames")
    if not isinstance(frames, list) or not frames:
        raise ValueError("holdout manifest frames must be a non-empty list")
    hashes = []
    indexes = []
    perceptual = []
    for row in frames:
        if not isinstance(row, dict):
            raise ValueError("holdout frame rows must be objects")
        index, digest = row.get("frame_index"), row.get("pixel_sha256")
        if isinstance(index, bool) or not isinstance(index, int) or index < 0:
            raise ValueError("holdout frame indexes must be non-negative integers")
        if not isinstance(digest, str) or not HEX_SHA256.fullmatch(digest):
            raise ValueError("holdout pixel hashes must be lowercase SHA-256")
        indexes.append(index)
        hashes.append(digest)
        if perceptual_mode:
            dhash64, phash64 = row.get("dhash64"), row.get("phash64")
            if not isinstance(dhash64, str) or not HEX64.fullmatch(dhash64):
                raise ValueError("holdout dHash values must be lowercase 64-bit hex")
            if not isinstance(phash64, str) or not HEX64.fullmatch(phash64):
                raise ValueError("holdout pHash values must be lowercase 64-bit hex")
            perceptual.append({
                "frame_index": index,
                "dhash64": dhash64,
                "phash64": phash64,
            })
    if len(indexes) != len(set(indexes)) or len(hashes) != len(set(hashes)):
        raise ValueError("holdout frame indexes and hashes must be unique")
    if payload.get("frame_count") != len(frames):
        raise ValueError("holdout frame_count does not match frames")
    if perceptual_mode:
        fingerprint = hashlib.sha256(
            json.dumps(frames, sort_keys=True, separators=(",", ":")).encode("ascii")
        ).hexdigest()
        if payload.get("frames_fingerprint_sha256") != fingerprint:
            raise ValueError("perceptual holdout frames fingerprint does not match rows")
    return {
        "schema_version": payload["schema_version"],
        "exact_hashes": set(hashes),
        "perceptual": perceptual,
    }


def hamming_hex64(first, second):
    if not isinstance(first, str) or not HEX64.fullmatch(first):
        raise ValueError("first perceptual hash must be lowercase 64-bit hex")
    if not isinstance(second, str) or not HEX64.fullmatch(second):
        raise ValueError("second perceptual hash must be lowercase 64-bit hex")
    return (int(first, 16) ^ int(second, 16)).bit_count()


def opencv_pixel_hasher(path):
    """Decode one training image under the same BGR pixel contract as the holdout."""
    try:
        import cv2
    except ImportError as exc:  # pragma: no cover - environment-specific
        raise RuntimeError("OpenCV is required to compare training images with the holdout") from exc
    frame = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError(f"could not decode image: {path}")
    return pixel_sha256(frame)


def opencv_perceptual_hasher(path):
    """Decode one image and calculate the validated dHash/pHash pair."""
    try:
        import cv2
    except ImportError as exc:  # pragma: no cover - environment-specific
        raise RuntimeError("OpenCV is required for perceptual holdout comparison") from exc
    frame = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError(f"could not decode image: {path}")
    return perceptual_hashes(frame, cv2_module=cv2)


def load_dataset_yaml(path):
    """Load a YAML file lazily so importing the validator needs no PyYAML."""
    try:
        import yaml
    except ImportError as exc:  # pragma: no cover - environment-specific
        raise RuntimeError("PyYAML is required to read the dataset YAML") from exc
    payload = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("dataset YAML must contain a mapping")
    return payload


def dataset_rejection_report(yaml_path, holdout_manifest_path, error):
    """Build portable evidence for a fail-closed dataset rejection."""
    yaml_path = Path(yaml_path)
    holdout_manifest_path = Path(holdout_manifest_path)
    message = str(error)
    try:
        root = str(yaml_path.resolve().parent)
    except OSError:
        root = str(yaml_path.parent)
    if root:
        message = message.replace(root, "<dataset_root>")
    report = {
        "schema_version": REJECTION_SCHEMA,
        "status": REJECTED_STATUS,
        "accuracy_status": "NOT_EVALUATED",
        "error_type": type(error).__name__,
        "error": message,
        "data_yaml_name": yaml_path.name,
        "holdout_manifest_name": holdout_manifest_path.name,
    }
    if yaml_path.is_file():
        report["data_yaml_sha256"] = sha256_file(yaml_path)
    if holdout_manifest_path.is_file():
        report["holdout_manifest_sha256"] = sha256_file(holdout_manifest_path)
    return report


def validate_yolo_dataset(
    config, yaml_path, holdout_manifest, *, image_pixel_hasher=None,
    image_perceptual_hasher=None,
):
    """Validate layout, labels, duplicates and exact held-out pixel exclusion."""
    if not isinstance(config, dict):
        raise ValueError("dataset configuration must be a mapping")
    yaml_path = Path(yaml_path).resolve()
    yaml_root = yaml_path.parent
    root_value = config.get("path", ".")
    if not isinstance(root_value, str) or "://" in root_value:
        raise ValueError("path must be one local directory")
    dataset_root = Path(root_value)
    if not dataset_root.is_absolute():
        dataset_root = yaml_root / dataset_root
    dataset_root = dataset_root.resolve()
    if not dataset_root.is_dir():
        raise ValueError(f"dataset root does not exist: {dataset_root}")

    class_name = _validate_class_schema(config)
    heldout = _holdout_contract(holdout_manifest)
    hasher = image_pixel_hasher or opencv_pixel_hasher
    perceptual_hasher = image_perceptual_hasher or opencv_perceptual_hasher
    use_perceptual = bool(heldout["perceptual"])
    seen_file_hashes = {}
    seen_pixel_hashes = {}
    rows = []
    split_reports = {}

    for split in ("train", "val", "test"):
        image_root = _resolve_split(dataset_root, config.get(split), split)
        label_root = _label_root(image_root)
        if not label_root.is_dir():
            raise ValueError(f"{split} labels directory does not exist: {label_root}")
        images = sorted(
            path for path in image_root.rglob("*")
            if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
        )
        if not images:
            raise ValueError(f"{split} contains no supported images")
        expected_labels = {_label_path(path, image_root, label_root).resolve() for path in images}
        actual_labels = {path.resolve() for path in label_root.rglob("*.txt") if path.is_file()}
        missing = sorted(expected_labels - actual_labels)
        orphaned = sorted(actual_labels - expected_labels)
        if missing:
            raise ValueError(f"{split} image has no label file: {missing[0]}")
        if orphaned:
            raise ValueError(f"{split} label has no image: {orphaned[0]}")

        box_count = 0
        negative_count = 0
        for image in images:
            label = _label_path(image, image_root, label_root)
            boxes = _parse_label(label)
            box_count += len(boxes)
            negative_count += int(not boxes)
            file_hash = sha256_file(image)
            if file_hash in seen_file_hashes:
                raise ValueError(
                    f"duplicate image bytes across dataset: {seen_file_hashes[file_hash]} and {image}"
                )
            seen_file_hashes[file_hash] = image
            pixel_hash = hasher(image)
            if not isinstance(pixel_hash, str) or not HEX_SHA256.fullmatch(pixel_hash):
                raise ValueError(f"pixel hasher returned invalid SHA-256 for {image}")
            if pixel_hash in heldout["exact_hashes"]:
                raise ValueError(f"held-out pixel contamination detected: {image}")
            if pixel_hash in seen_pixel_hashes:
                raise ValueError(
                    f"duplicate decoded pixels across dataset: {seen_pixel_hashes[pixel_hash]} and {image}"
                )
            seen_pixel_hashes[pixel_hash] = image
            row = {
                "split": split,
                "image": image.relative_to(dataset_root).as_posix(),
                "label": label.relative_to(dataset_root).as_posix(),
                "image_sha256": file_hash,
                "label_sha256": sha256_file(label),
                "pixel_sha256": pixel_hash,
                "box_count": len(boxes),
            }
            if use_perceptual:
                image_perceptual = perceptual_hasher(image)
                if not isinstance(image_perceptual, dict):
                    raise ValueError(f"perceptual hasher returned invalid result for {image}")
                dhash64 = image_perceptual.get("dhash64")
                phash64 = image_perceptual.get("phash64")
                if not isinstance(dhash64, str) or not HEX64.fullmatch(dhash64):
                    raise ValueError(f"perceptual hasher returned invalid dHash for {image}")
                if not isinstance(phash64, str) or not HEX64.fullmatch(phash64):
                    raise ValueError(f"perceptual hasher returned invalid pHash for {image}")
                for reference in heldout["perceptual"]:
                    dhash_distance = hamming_hex64(dhash64, reference["dhash64"])
                    phash_distance = hamming_hex64(phash64, reference["phash64"])
                    if (
                        dhash_distance <= DHASH64_MAX_DISTANCE
                        and phash_distance <= PHASH64_MAX_DISTANCE
                    ):
                        raise ValueError(
                            "held-out perceptual contamination detected: "
                            f"{image} matches frame {reference['frame_index']} "
                            f"(dHash={dhash_distance}, pHash={phash_distance})"
                        )
                row.update({"dhash64": dhash64, "phash64": phash64})
            rows.append(row)
        split_reports[split] = {
            "image_count": len(images),
            "label_count": len(images),
            "box_count": box_count,
            "negative_image_count": negative_count,
        }

    if split_reports["train"]["box_count"] == 0:
        raise ValueError("train must contain at least one labeled ball box")

    rows.sort(key=lambda row: (row["split"], row["image"]))
    fingerprint = hashlib.sha256(
        json.dumps(rows, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return {
        "schema_version": SCHEMA,
        "status": PERCEPTUAL_STATUS if use_perceptual else STATUS,
        "accuracy_status": "NOT_EVALUATED",
        "dataset": {
            "root": "<dataset_root>",
            "class_count": 1,
            "class_id": 0,
            "class_name": class_name,
            "fingerprint_sha256": fingerprint,
        },
        "splits": split_reports,
        "totals": {
            "image_count": len(rows),
            "label_count": len(rows),
            "box_count": sum(row["box_count"] for row in rows),
            "negative_image_count": sum(value["negative_image_count"] for value in split_reports.values()),
        },
        "holdout": {
            "schema_version": heldout["schema_version"],
            "frame_count": len(heldout["exact_hashes"]),
            "frames_fingerprint_sha256": holdout_manifest.get("frames_fingerprint_sha256"),
            "pixel_overlap_count": 0,
            "perceptual_match_count": 0 if use_perceptual else None,
            "perceptual_thresholds": {
                "dhash64_max_hamming": DHASH64_MAX_DISTANCE,
                "phash64_max_hamming": PHASH64_MAX_DISTANCE,
            } if use_perceptual else None,
        },
        "files": rows,
    }

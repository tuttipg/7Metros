"""Pixel-level provenance for the real frames reserved for ball evaluation."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .ball_ground_truth import sha256_file


SCHEMA = "sevenmetros.ball-holdout-pixels/v1"
PERCEPTUAL_SCHEMA = "sevenmetros.ball-holdout-perceptual/v1"
CACHE_SCHEMA = "sevenmetros.ball-detection-cache/v2"
DHASH64_MAX_DISTANCE = 3
PHASH64_MAX_DISTANCE = 2


def load_cache_contract(path, video):
    """Validate a v2 detection cache and return its exact frame contract."""
    path, video = Path(path), Path(video)
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("schema_version") != CACHE_SCHEMA:
        raise ValueError(f"cache schema must be {CACHE_SCHEMA}")
    actual_video_sha256 = sha256_file(video)
    if payload.get("source", {}).get("video_sha256") != actual_video_sha256:
        raise ValueError("video SHA256 differs from detection cache")
    rows = payload.get("frames")
    if not isinstance(rows, list) or not rows:
        raise ValueError("cache frames must be a non-empty list")
    frame_indices = []
    for row in rows:
        frame_index = row.get("frame_index") if isinstance(row, dict) else None
        if isinstance(frame_index, bool) or not isinstance(frame_index, int) or frame_index < 0:
            raise ValueError("cache frame indexes must be non-negative integers")
        frame_indices.append(frame_index)
    if len(frame_indices) != len(set(frame_indices)):
        raise ValueError("cache frame indexes must be unique")
    return {
        "video_sha256": actual_video_sha256,
        "cache_sha256": sha256_file(path),
        "cache_schema": payload["schema_version"],
        "frame_indices": sorted(frame_indices),
    }


def pixel_sha256(frame):
    """Hash shape, dtype and contiguous BGR pixel bytes as one contract."""
    try:
        shape = [int(value) for value in frame.shape]
        dtype = str(frame.dtype)
        pixels = frame.tobytes(order="C")
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValueError("frame must expose shape, dtype and C-order bytes") from exc
    if len(shape) != 3 or shape[2] != 3 or dtype != "uint8":
        raise ValueError("frame must be HxWx3 uint8 BGR")
    header = json.dumps(
        {"shape": shape, "dtype": dtype, "pixel_layout": "BGR"},
        sort_keys=True,
        separators=(",", ":"),
    ).encode("ascii")
    return hashlib.sha256(header + b"\n" + pixels).hexdigest()


def _bits_hex64(bits):
    value = 0
    flat = bits.reshape(-1)
    if len(flat) != 64:
        raise ValueError("perceptual hash must contain exactly 64 bits")
    for bit in flat:
        value = (value << 1) | int(bool(bit))
    return f"{value:016x}"


def perceptual_hashes(frame, *, cv2_module=None):
    """Return deterministic dHash/pHash fingerprints for a decoded BGR frame."""
    pixel_sha256(frame)  # Validate the shared HxWx3 uint8 BGR contract first.
    if cv2_module is None:  # pragma: no cover - exercised by real evidence run
        try:
            import cv2 as cv2_module
        except ImportError as exc:
            raise RuntimeError("OpenCV is required for perceptual fingerprints") from exc
    gray = cv2_module.cvtColor(frame, cv2_module.COLOR_BGR2GRAY)
    dhash_input = cv2_module.resize(gray, (9, 8), interpolation=cv2_module.INTER_AREA)
    dhash64 = _bits_hex64(dhash_input[:, 1:] > dhash_input[:, :-1])

    phash_input = cv2_module.resize(gray, (32, 32), interpolation=cv2_module.INTER_AREA)
    coefficients = cv2_module.dct(phash_input.astype("float32"))[:8, :8]
    non_dc = sorted(float(value) for value in coefficients.reshape(-1)[1:])
    median = non_dc[len(non_dc) // 2]
    phash64 = _bits_hex64(coefficients > median)
    return {"dhash64": dhash64, "phash64": phash64}


def extract_pixel_hashes(video, frame_indices, *, cv2_module=None):
    """Decode sequentially and hash only requested zero-based frames."""
    if cv2_module is None:  # pragma: no cover - exercised by real evidence run
        try:
            import cv2 as cv2_module
        except ImportError as exc:
            raise RuntimeError("OpenCV is required to fingerprint held-out frames") from exc
    targets = set(frame_indices)
    if not targets:
        raise ValueError("at least one frame is required")
    capture = cv2_module.VideoCapture(str(video))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video: {video}")
    found = []
    try:
        for frame_index in range(max(targets) + 1):
            ok, frame = capture.read()
            if not ok:
                break
            if frame_index in targets:
                found.append({
                    "frame_index": frame_index,
                    "pixel_sha256": pixel_sha256(frame),
                })
    finally:
        capture.release()
    found_indices = [row["frame_index"] for row in found]
    if found_indices != sorted(targets):
        missing = sorted(targets - set(found_indices))
        raise RuntimeError(f"video ended before held-out frames: {missing[:10]}")
    return found


def build_holdout_manifest(video, cache, *, cv2_module=None):
    contract = load_cache_contract(cache, video)
    if cv2_module is None:  # pragma: no cover - exercised by real evidence run
        import cv2 as cv2_module
    frames = extract_pixel_hashes(
        video, contract["frame_indices"], cv2_module=cv2_module,
    )
    digests = [row["pixel_sha256"] for row in frames]
    if len(digests) != len(set(digests)):
        raise ValueError("held-out sample contains pixel-identical frames")
    fingerprint = hashlib.sha256(
        json.dumps(frames, sort_keys=True, separators=(",", ":")).encode("ascii")
    ).hexdigest()
    return {
        "schema_version": SCHEMA,
        "status": "HELDOUT_PIXEL_FINGERPRINTS_NOT_MODEL_ACCURACY",
        "source": {
            "video_sha256": contract["video_sha256"],
            "detection_cache_sha256": contract["cache_sha256"],
            "detection_cache_schema": contract["cache_schema"],
        },
        "decoder": {
            "opencv_version": str(cv2_module.__version__),
            "pixel_layout": "BGR",
            "dtype": "uint8",
            "hash_contract": "sha256(canonical shape/dtype/layout header + newline + C-order pixels)",
        },
        "frame_count": len(frames),
        "frames_fingerprint_sha256": fingerprint,
        "frames": frames,
    }


def build_perceptual_holdout_manifest(
    video, cache, *, cv2_module=None, perceptual_hasher=None,
):
    """Build exact and perceptual fingerprints for the held-out frame contract."""
    contract = load_cache_contract(cache, video)
    if cv2_module is None:  # pragma: no cover - exercised by real evidence run
        try:
            import cv2 as cv2_module
        except ImportError as exc:
            raise RuntimeError("OpenCV is required to fingerprint held-out frames") from exc
    if perceptual_hasher is None:
        perceptual_hasher = lambda frame: perceptual_hashes(
            frame, cv2_module=cv2_module,
        )
    targets = set(contract["frame_indices"])
    capture = cv2_module.VideoCapture(str(video))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video: {video}")
    frames = []
    try:
        for frame_index in range(max(targets) + 1):
            ok, frame = capture.read()
            if not ok:
                break
            if frame_index in targets:
                perceptual = perceptual_hasher(frame)
                if not isinstance(perceptual, dict):
                    raise ValueError("perceptual hasher must return a mapping")
                for key in ("dhash64", "phash64"):
                    value = perceptual.get(key)
                    if not isinstance(value, str) or len(value) != 16 or any(
                        character not in "0123456789abcdef" for character in value
                    ):
                        raise ValueError(f"perceptual hasher returned invalid {key}")
                frames.append({
                    "frame_index": frame_index,
                    "pixel_sha256": pixel_sha256(frame),
                    "dhash64": perceptual["dhash64"],
                    "phash64": perceptual["phash64"],
                })
    finally:
        capture.release()
    found = [row["frame_index"] for row in frames]
    if found != sorted(targets):
        missing = sorted(targets - set(found))
        raise RuntimeError(f"video ended before held-out frames: {missing[:10]}")
    exact_hashes = [row["pixel_sha256"] for row in frames]
    if len(exact_hashes) != len(set(exact_hashes)):
        raise ValueError("held-out sample contains pixel-identical frames")
    fingerprint = hashlib.sha256(
        json.dumps(frames, sort_keys=True, separators=(",", ":")).encode("ascii")
    ).hexdigest()
    return {
        "schema_version": PERCEPTUAL_SCHEMA,
        "status": "HELDOUT_EXACT_AND_PERCEPTUAL_FINGERPRINTS_NOT_MODEL_ACCURACY",
        "source": {
            "video_sha256": contract["video_sha256"],
            "detection_cache_sha256": contract["cache_sha256"],
            "detection_cache_schema": contract["cache_schema"],
        },
        "decoder": {
            "opencv_version": str(cv2_module.__version__),
            "pixel_layout": "BGR",
            "dtype": "uint8",
        },
        "perceptual_match": {
            "logic": "dhash64_distance_lte_AND_phash64_distance_lte",
            "dhash64_max_hamming": DHASH64_MAX_DISTANCE,
            "phash64_max_hamming": PHASH64_MAX_DISTANCE,
            "dhash64_contract": "8x8 horizontal grayscale gradient after INTER_AREA resize",
            "phash64_contract": "8x8 low-frequency DCT above non-DC median after 32x32 INTER_AREA resize",
        },
        "frame_count": len(frames),
        "frames_fingerprint_sha256": fingerprint,
        "frames": frames,
    }

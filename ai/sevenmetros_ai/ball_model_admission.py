"""Fail-closed admission checks for external handball detector checkpoints.

Admission only means that a checkpoint is reproducible and eligible for a
held-out evaluation. It does not imply that the model is accurate.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlparse


SCHEMA = "sevenmetros.ball-model-provenance/v1"
ADMITTED = "ADMITTED_FOR_HELDOUT_EVALUATION_NOT_ACCURACY"
REJECTED = "REJECTED_MODEL_ADMISSION"
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_BALL_NAMES = {"ball", "ballon", "balon", "pelota", "handball"}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _https_url(value) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def _model_names(model):
    names = getattr(model, "names", None)
    if isinstance(names, dict):
        return {int(key): str(value) for key, value in names.items()}
    if isinstance(names, (list, tuple)):
        return dict(enumerate(str(value) for value in names))
    return None


def _default_loader(path: Path):
    try:
        from ultralytics import YOLO
    except ImportError as exc:  # pragma: no cover - optional runtime
        raise RuntimeError("Ultralytics is required to inspect a checkpoint") from exc
    return YOLO(str(path))


def admit_ball_model(model_path, provenance_path, evaluation_video_sha256, *, model_loader=None):
    """Return a deterministic admission report; validation failures are data."""
    model_path, provenance_path = Path(model_path), Path(provenance_path)
    errors = []
    report = {
        "schema": "sevenmetros.ball-model-admission/v1",
        "status": REJECTED,
        "accuracy_status": "NOT_EVALUATED",
        "model_name": model_path.name,
        "provenance_path": str(provenance_path),
        "evaluation_video_sha256": evaluation_video_sha256,
    }
    if not _SHA256.fullmatch(str(evaluation_video_sha256)):
        errors.append("evaluation_video_sha256 must be 64 lowercase hex characters")
    if not model_path.is_file():
        errors.append("model file does not exist")
    else:
        report.update(model_bytes=model_path.stat().st_size, model_sha256=sha256_file(model_path))
    if not provenance_path.is_file():
        errors.append("provenance file does not exist")
        report["errors"] = errors
        return report
    report["provenance_sha256"] = sha256_file(provenance_path)
    try:
        provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"invalid provenance JSON: {exc}")
        report["errors"] = errors
        return report

    if provenance.get("schema") != SCHEMA:
        errors.append(f"provenance schema must be {SCHEMA}")
    if report.get("model_sha256") != provenance.get("model_sha256"):
        errors.append("model SHA256 differs from provenance")
    if not _https_url(provenance.get("source_url")):
        errors.append("source_url must be an HTTPS URL")
    license_info = provenance.get("license")
    if not isinstance(license_info, dict) or not license_info.get("id"):
        errors.append("license.id is required")
    elif not _https_url(license_info.get("url")):
        errors.append("license.url must be an HTTPS URL")
    training_data = provenance.get("training_data")
    if not isinstance(training_data, list) or not training_data:
        errors.append("at least one training_data source is required")
    else:
        for index, source in enumerate(training_data):
            if not isinstance(source, dict) or not _https_url(source.get("url")):
                errors.append(f"training_data[{index}].url must be an HTTPS URL")
            if not isinstance(source, dict) or not source.get("license_id"):
                errors.append(f"training_data[{index}].license_id is required")
    exclusions = provenance.get("evaluation_exclusions")
    if not isinstance(exclusions, list) or not any(
        isinstance(item, dict)
        and item.get("video_sha256") == evaluation_video_sha256
        and item.get("excluded_from_training") is True
        for item in exclusions
    ):
        errors.append("evaluation video is not explicitly excluded from training")
    declared = provenance.get("model")
    if not isinstance(declared, dict):
        errors.append("model metadata is required")
        declared = {}
    class_id = declared.get("ball_class_id")
    if isinstance(class_id, bool) or not isinstance(class_id, int) or class_id < 0:
        errors.append("model.ball_class_id must be a non-negative integer")
    class_name = str(declared.get("ball_class_name", "")).strip().casefold()
    if class_name not in _BALL_NAMES:
        errors.append("model.ball_class_name is not a recognized ball label")
    if declared.get("task") != "detect":
        errors.append("model.task must be detect")
    if declared.get("specialized_single_class") is not True:
        errors.append("model must declare specialized_single_class=true")

    # Do not deserialize until bytes and documentary contract pass. PyTorch
    # checkpoints must nevertheless come from a trusted source.
    if not errors:
        try:
            loaded = (model_loader or _default_loader)(model_path)
            names, task = _model_names(loaded), getattr(loaded, "task", None)
            report.update(inspected_task=task, inspected_classes=names)
            if task != "detect":
                errors.append("checkpoint task is not detect")
            if names is None:
                errors.append("checkpoint does not expose class names")
            elif len(names) != 1:
                errors.append("checkpoint is not single-class specialized")
            elif class_id not in names:
                errors.append("declared ball class id is absent from checkpoint")
            elif names[class_id].strip().casefold() != class_name:
                errors.append("declared ball class name differs from checkpoint")
        except Exception as exc:
            errors.append(f"checkpoint inspection failed: {type(exc).__name__}: {exc}")
    report["errors"] = errors
    if not errors:
        report["status"] = ADMITTED
    return report

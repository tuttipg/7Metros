"""Fail-closed rights screening for external ball-training sources.

Passing this screen only means that documented source terms are compatible
with the declared use. It does not admit a dataset or measure model accuracy.
"""
from __future__ import annotations

from datetime import date
from urllib.parse import urlparse


SCHEMA = "sevenmetros.ball-training-sources/v1"
PASSED = "SOURCE_RIGHTS_SCREEN_PASSED_NOT_DATASET_ADMISSION"
REJECTED = "REJECTED_TRAINING_SOURCE_RIGHTS"
INTENDED_USES = {"product", "research_noncommercial"}
REQUIRED_ROLES = {"original_media", "annotations"}

# Keep the automated policy deliberately narrow. Unknown licenses require a
# human legal review rather than an optimistic guess.
LICENSE_POLICY = {
    "CC-BY-4.0": {"commercial": True, "obligations": {"attribution"}},
    "CC-BY-SA-4.0": {
        "commercial": True,
        "obligations": {"attribution", "share_alike"},
    },
    "CC-BY-NC-4.0": {
        "commercial": False,
        "obligations": {"attribution", "noncommercial_only"},
    },
    "CC-BY-NC-SA-4.0": {
        "commercial": False,
        "obligations": {"attribution", "noncommercial_only", "share_alike"},
    },
}


def _https_url(value):
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def _iso_date(value):
    if not isinstance(value, str):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def screen_training_sources(payload, intended_use):
    """Return a deterministic source-rights report; failures are data."""
    errors = []
    report = {
        "schema": "sevenmetros.ball-training-source-screen/v1",
        "status": REJECTED,
        "intended_use": intended_use,
        "dataset_admission_status": "NOT_EVALUATED",
        "model_accuracy_status": "NOT_EVALUATED",
    }
    if intended_use not in INTENDED_USES:
        errors.append(
            "intended_use must be product or research_noncommercial"
        )
    if not isinstance(payload, dict):
        errors.append("source manifest must be a JSON object")
        report["errors"] = errors
        return report
    if payload.get("schema") != SCHEMA:
        errors.append(f"source manifest schema must be {SCHEMA}")
    title = payload.get("dataset_title")
    if not isinstance(title, str) or not title.strip():
        errors.append("dataset_title is required")
    else:
        report["dataset_title"] = title.strip()
    if payload.get("domain") != "team_handball":
        errors.append("domain must be team_handball")

    sources = payload.get("sources")
    covered_roles = set()
    if not isinstance(sources, list) or not sources:
        errors.append("at least one source is required")
        sources = []
    for index, source in enumerate(sources):
        prefix = f"sources[{index}]"
        if not isinstance(source, dict):
            errors.append(f"{prefix} must be an object")
            continue
        role = source.get("role")
        if role not in REQUIRED_ROLES:
            errors.append(
                f"{prefix}.role must be original_media or annotations"
            )
        else:
            covered_roles.add(role)
        if not _https_url(source.get("url")):
            errors.append(f"{prefix}.url must be an HTTPS URL")
        if not _iso_date(source.get("terms_accessed_on")):
            errors.append(f"{prefix}.terms_accessed_on must be an ISO date")
        attribution = source.get("attribution")
        if not isinstance(attribution, str) or not attribution.strip():
            errors.append(f"{prefix}.attribution is required")

        license_info = source.get("license")
        if not isinstance(license_info, dict):
            errors.append(f"{prefix}.license must be an object")
            continue
        license_id = license_info.get("id")
        policy = LICENSE_POLICY.get(license_id)
        if not _https_url(license_info.get("url")):
            errors.append(f"{prefix}.license.url must be an HTTPS URL")
        if policy is None:
            errors.append(f"{prefix}.license.id is not in the reviewed policy")
            continue
        obligations = source.get("obligations")
        if not isinstance(obligations, list) or not all(
            isinstance(item, str) for item in obligations
        ):
            errors.append(f"{prefix}.obligations must be a string list")
            obligations = []
        missing = sorted(policy["obligations"] - set(obligations))
        if missing:
            errors.append(
                f"{prefix}.obligations omits license duties: {', '.join(missing)}"
            )
        if intended_use == "product" and not policy["commercial"]:
            errors.append(
                f"{prefix}.license.id {license_id} forbids product/commercial use"
            )

    missing_roles = sorted(REQUIRED_ROLES - covered_roles)
    if missing_roles:
        errors.append(
            "source manifest lacks rights coverage for: " + ", ".join(missing_roles)
        )
    report["source_count"] = len(sources)
    report["covered_roles"] = sorted(covered_roles)
    report["errors"] = errors
    if not errors:
        report["status"] = PASSED
    return report

"""Opt-in linear interpolation for short internal gaps in 7Metros JSONL tracks."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from sevenmetros_ai.postprocess import interpolate_short_internal_gaps


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON on line {line_number}: {exc}") from exc
    return rows


def write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as stream:
        for row in rows:
            stream.write(json.dumps(row, separators=(",", ":")) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--max-missing-frames", type=int, default=5)
    parser.add_argument("--report")
    args = parser.parse_args()

    source = Path(args.input)
    destination = Path(args.output)
    if source.resolve() == destination.resolve():
        parser.error("--input and --output must be different files")
    if not source.is_file():
        parser.error(f"Input does not exist: {source}")
    if destination.exists():
        parser.error(f"Output already exists: {destination}")

    rows = load_jsonl(source)
    processed, report = interpolate_short_internal_gaps(
        rows, max_missing_frames=args.max_missing_frames
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    write_jsonl(destination, processed)

    report = {
        **report,
        "input": str(source),
        "output": str(destination),
        "frames": len(processed),
        "default_pipeline_changed": False,
        "accuracy_status": "postprocess_only; evaluate against ground truth before promotion",
    }
    rendered = json.dumps(report, indent=2) + "\n"
    if args.report:
        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(rendered, encoding="utf-8")
    print(rendered, end="")


if __name__ == "__main__":
    main()

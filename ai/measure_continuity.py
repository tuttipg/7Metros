"""Recompute continuity metrics from existing JSONL without detector inference."""
import argparse
import json
from pathlib import Path
from types import SimpleNamespace
from sevenmetros_ai.metrics import TrackingMetrics


def measure(path):
    metrics=TrackingMetrics()
    with Path(path).open() as stream:
        for line in stream:
            row=json.loads(line)
            metrics.observe(row['frame_index'],[SimpleNamespace(track_id=o['track_id']) for o in row['objects']])
    return metrics.summary()


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('tracks',nargs='+');args=p.parse_args()
    print(json.dumps({f:measure(f) for f in args.tracks},indent=2))

#!/usr/bin/env python3
"""Evaluación reproducible del baseline 7Metros.

Compara detecciones JSONL con ground truth JSONL usando IoU por frame/clase.
Métricas: precision, recall, F1, mean IoU y tasa de detecciones con track ID.
Para benchmarking MOT completo se recomienda HOTA/IDF1 con TrackEval cuando exista
un dataset anotado suficiente.
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any


def load(path: Path) -> list[dict[str, Any]]:
    rows = []
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def iou(a: list[float], b: list[float]) -> float:
    ax1, ay1, ax2, ay2 = map(float, a); bx1, by1, bx2, by2 = map(float, b)
    ix1, iy1 = max(ax1,bx1), max(ay1,by1); ix2, iy2 = min(ax2,bx2), min(ay2,by2)
    iw, ih = max(0.0, ix2-ix1), max(0.0, iy2-iy1)
    inter = iw * ih
    area_a = max(0.0, ax2-ax1) * max(0.0, ay2-ay1)
    area_b = max(0.0, bx2-bx1) * max(0.0, by2-by1)
    union = area_a + area_b - inter
    return inter / union if union else 0.0


def evaluate(truth: list[dict[str, Any]], pred: list[dict[str, Any]], threshold: float) -> dict[str, Any]:
    gt_by_frame: dict[tuple[int,str], list[dict[str,Any]]] = defaultdict(list)
    pr_by_frame: dict[tuple[int,str], list[dict[str,Any]]] = defaultdict(list)
    for row in truth: gt_by_frame[(int(row['frame']), str(row.get('class','')))].append(row)
    for row in pred: pr_by_frame[(int(row['frame']), str(row.get('class','')))].append(row)
    tp = fp = fn = 0; matched_ious: list[float] = []
    for key in set(gt_by_frame) | set(pr_by_frame):
        gt = gt_by_frame[key]; pr = sorted(pr_by_frame[key], key=lambda x: float(x.get('confidence',1)), reverse=True)
        used: set[int] = set()
        for p in pr:
            candidates = [(iou(p['bbox'], g['bbox']), idx) for idx,g in enumerate(gt) if idx not in used]
            best_iou, best_idx = max(candidates, default=(0.0,-1))
            if best_iou >= threshold:
                tp += 1; used.add(best_idx); matched_ious.append(best_iou)
            else: fp += 1
        fn += len(gt) - len(used)
    precision = tp/(tp+fp) if tp+fp else 0.0
    recall = tp/(tp+fn) if tp+fn else 0.0
    f1 = 2*precision*recall/(precision+recall) if precision+recall else 0.0
    tracked = sum(1 for p in pred if p.get('track_id') not in (None,''))
    return {
        'iou_threshold': threshold, 'tp': tp, 'fp': fp, 'fn': fn,
        'precision': round(precision,4), 'recall': round(recall,4), 'f1': round(f1,4),
        'mean_iou': round(sum(matched_ious)/len(matched_ious),4) if matched_ious else 0.0,
        'track_id_coverage': round(tracked/len(pred),4) if pred else 0.0,
        'ground_truth_objects': len(truth), 'predicted_objects': len(pred)
    }


def main() -> int:
    p = argparse.ArgumentParser(description='Evalúa detección baseline de 7Metros')
    p.add_argument('ground_truth', type=Path); p.add_argument('predictions', type=Path)
    p.add_argument('--iou', type=float, default=0.5)
    args = p.parse_args()
    if not 0 < args.iou <= 1: raise SystemExit('--iou debe estar entre 0 y 1')
    print(json.dumps(evaluate(load(args.ground_truth), load(args.predictions), args.iou), ensure_ascii=False, indent=2))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())

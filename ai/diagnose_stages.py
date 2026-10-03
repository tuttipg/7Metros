"""Audit the recorded blue-court pipeline without rerunning native inference.

Removal reasons reflect pipeline stages, not ground-truth false negatives.
Applicable to the recorded fixture duplicate threshold .55 only.
"""
import argparse
from collections import Counter
from itertools import zip_longest
import json
from pathlib import Path

from sevenmetros_ai.fixture_filter import suppress_duplicates
from sevenmetros_ai.tracking import Detection


def detection_key(d):
    return tuple(round(float(v),3) for v in (d.x1,d.y1,d.x2,d.y2))+(d.label,round(float(d.confidence),6))


def object_detection(o):
    return Detection(*o['bbox_xyxy'],confidence=o['confidence'],label=o['kind'])


def point_status(detections, points):
    """Only local box indices, not identities, are compared across stages."""
    matches=[]
    for p in points:
        x,y=p['xy']
        boxes=[i for i,d in enumerate(detections) if d.x1<=x<=d.x2 and d.y1<=y<=d.y2]
        matches.append(dict(p,boxes=boxes,status='unique_box' if len(boxes)==1 else 'ambiguous' if boxes else 'missing'))
    owners=Counter(m['boxes'][0] for m in matches if m['status']=='unique_box')
    for m in matches:
        if m['status']=='unique_box' and owners[m['boxes'][0]]>1:m['status']='shared_box'
    return matches


def diagnose_frame(raw, row, points=()):
    ds=[Detection(**d) for d in raw]
    dedup=suppress_duplicates(ds)
    observed=[object_detection(o) for o in row['objects']]
    eligible=Counter(map(detection_key,dedup));actual=Counter(map(detection_key,observed))
    if actual-eligible:
        raise ValueError('Tracks are not a subset of this detector/cache/filter configuration')
    # On frames with no court the real filter returns before deduplication;
    # report the hypothetical duplicate stage separately and preserve that caveat.
    return dict(frame=row['frame_index'],raw=len(ds),after_duplicate_rule=len(dedup),output=len(observed),
                duplicate_rule_removals=len(ds)-len(dedup),court_stage_removals=len(dedup)-len(observed),
                raw_points=point_status(ds,points),dedup_points=point_status(dedup,points),
                output_points=point_status(observed,points))


def diagnose(cache, tracks, references=()):
    cache=Path(cache);tracks=Path(tracks)
    meta=json.loads(cache.with_suffix('.meta.json').read_text())
    run=json.loads((tracks.parent/'metrics.json').read_text())
    if run.get('two_stage'):
        raise ValueError('Two-stage can discard unmatched weak detections; court-only attribution is invalid')
    for key in ('video_sha256','model','confidence'):
        if not meta.get(key) or meta[key]!=run.get(key):raise ValueError('Provenance mismatch: '+key)
    if not run.get('fixture_kits'):raise ValueError('Expected recorded fixture_kits run')
    points={}
    for refpath in references:
        ref=json.loads(Path(refpath).read_text())
        if ref['video_sha256']!=meta['video_sha256']:raise ValueError('Reference video mismatch')
        for p in ref['points']:points.setdefault(p['frame'],[]).append(p)
    frames=[];totals=Counter()
    with cache.open() as a,tracks.open() as b:
        for i,pair in enumerate(zip_longest(a,b)):
            if None in pair:raise ValueError('Cache and tracks differ in length')
            raw,row=map(json.loads,pair)
            if row['frame_index']!=i:raise ValueError('Nonsequential frames')
            result=diagnose_frame(raw,row,points.get(i,()))
            for key in ('raw','after_duplicate_rule','output','duplicate_rule_removals','court_stage_removals'):
                totals[key]+=result[key]
            frames.append(result)
    if len(frames)!=run['frames_processed']:raise ValueError('Summary frame count mismatch')
    if any(f>=len(frames) for f in points):raise ValueError('Reference outside clip')
    return dict(source=meta,frames=len(frames),totals=dict(totals),
                zero_output_frames=sum(f['output']==0 for f in frames),per_frame=frames,
                zero_raw_frames=sum(f['raw']==0 for f in frames),
                all_removed_nonempty_frames=sum(f['raw']>0 and f['output']==0 for f in frames),
                limitations=['No ground-truth precision or recall.',
                    'Court removals combine outside-hull and absent court evidence; native mask not replayed.',
                    'Duplicate rule is evaluated before court even if original frame lacked court.',
                    'No unmatched detection loss in this tracker: every surviving detection gets an output ID.'])


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--cache',required=True);p.add_argument('--tracks',required=True)
    p.add_argument('--reference',action='append',default=[]);args=p.parse_args()
    print(json.dumps(diagnose(args.cache,args.tracks,args.reference),indent=2))

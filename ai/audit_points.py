"""Sparse visual audit. Ambiguous point/box overlaps never count as a match."""
import argparse
import json
from collections import defaultdict


def audit(reference, frames):
    observations=[]
    sequences=defaultdict(list)
    for point in reference['points']:
        frame=frames.get(point['frame'])
        if frame is None:
            raise ValueError('Missing annotated frame')
        if frame['image'] != {'width':reference['width'],'height':reference['height']}:
            raise ValueError('Reference/video dimensions differ')
        x,y=point['xy']
        candidates=[o['track_id'] for o in frame['objects']
                    if o['bbox_xyxy'][0]<=x<=o['bbox_xyxy'][2]
                    and o['bbox_xyxy'][1]<=y<=o['bbox_xyxy'][3]]
        status='matched' if len(candidates)==1 else ('missed' if not candidates else 'ambiguous')
        observations.append(dict(point,status=status,track_ids=candidates))
    # A single detection covering multiple reference people is a merged box,
    # not two successful matches. Exclude all such points from ID sequences.
    owners=defaultdict(list)
    for p in observations:
        if p['status']=='matched':owners[(p['frame'],p['track_ids'][0])].append(p)
    for group in owners.values():
        if len({p['person'] for p in group})>1:
            for p in group:p['status']='shared_box'
    for p in sorted(observations,key=lambda p:p['frame']):
        if p['status']=='matched':sequences[p['person']].append(p['track_ids'][0])
    return {'points':observations,'matched':sum(p['status']=='matched' for p in observations),
            'ambiguous':sum(p['status']=='ambiguous' for p in observations),
            'missed':sum(p['status']=='missed' for p in observations),
            'shared_box_points':sum(p['status']=='shared_box' for p in observations),
            'id_sequences':dict(sequences),
            'sampled_id_changes':sum(a!=b for ids in sequences.values() for a,b in zip(ids,ids[1:])),
            'limitation':reference['scope'], 'standard_MOT_metrics':None}


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--reference',required=True);p.add_argument('tracks',nargs='+')
    args=p.parse_args()
    with open(args.reference) as f: ref=json.load(f)
    wanted={p['frame'] for p in ref['points']}
    results={}
    for path in args.tracks:
        frames={}
        with open(path) as f:
            for line in f:
                row=json.loads(line)
                if row['frame_index'] in wanted: frames[row['frame_index']]=row
        results[path]=audit(ref,frames)
    print(json.dumps(results,indent=2))

"""Build a reviewable MOT-style annotation task from tracker proposals.

The exported ``seed/seed.txt`` is explicitly unverified tracker output.  It is
never written as ``gt/gt.txt`` and must not be used for accuracy claims before
complete human review.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

from compare_video import load_window


STATUS = 'UNVERIFIED_TRACKER_PROPOSAL_NOT_GROUND_TRUTH'


def sha256_file(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def validate_object(observation, width, height):
    required = {'track_id', 'bbox_xyxy', 'confidence', 'kind'}
    missing = required.difference(observation)
    if missing:
        raise ValueError(f'Missing object fields: {sorted(missing)}')
    box = observation['bbox_xyxy']
    if len(box) != 4:
        raise ValueError('bbox_xyxy must contain four values')
    x1, y1, x2, y2 = (float(value) for value in box)
    if not (0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height):
        raise ValueError(f'Out-of-bounds or degenerate box: {box}')
    track_id = float(observation['track_id'])
    confidence = float(observation['confidence'])
    if not math.isfinite(track_id) or not track_id.is_integer() or track_id <= 0:
        raise ValueError('track_id must be positive')
    if not math.isfinite(confidence) or not 0 <= confidence <= 1:
        raise ValueError('confidence must be finite and in [0,1]')
    if observation['kind'] != 'player':
        raise ValueError('Only player observations belong in this task')
    return x1, y1, x2, y2


def mot_seed_row(relative_frame, observation, width, height):
    x1, y1, x2, y2 = validate_object(observation, width, height)
    # MOTChallenge-like columns: frame,id,x,y,w,h,score,class,visibility.
    # Class 1 means person in this handball-specific task. Visibility remains
    # unknown (-1) until human review.
    return [
        int(relative_frame), int(observation['track_id']),
        round(x1, 3), round(y1, 3), round(x2 - x1, 3), round(y2 - y1, 3),
        round(float(observation['confidence']), 6), 1, -1,
    ]


def ensure_new_output(path):
    path = Path(path)
    if path.exists() and any(path.iterdir()):
        raise ValueError(f'Output directory is not empty: {path}')
    path.mkdir(parents=True, exist_ok=True)
    return path


def prepare(video, tracks, output, start=3.5, seconds=3.5, jpeg_quality=95):
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError('OpenCV is required to extract annotation frames') from exc

    if start < 0 or seconds <= 0:
        raise ValueError('Invalid time range')
    if not 1 <= jpeg_quality <= 100:
        raise ValueError('jpeg_quality must be in [1,100]')
    video, tracks = Path(video), Path(tracks)
    output = Path(output)
    resolved_inputs = {video.resolve(), tracks.resolve()}
    if output.resolve() in resolved_inputs:
        raise ValueError('Output must differ from inputs')
    output = ensure_new_output(output)
    image_dir = output / 'img1'
    seed_dir = output / 'seed'
    image_dir.mkdir()
    seed_dir.mkdir()

    capture = cv2.VideoCapture(str(video))
    try:
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        if not capture.isOpened() or fps <= 0 or width <= 0 or height <= 0:
            raise ValueError('Invalid input video')
        first, last = int(start * fps), int((start + seconds) * fps)
        if last <= first:
            raise ValueError('Selected range contains no frames')
        rows = load_window(tracks, first, last)
        missing = [index for index in range(first, last) if index not in rows]
        if missing:
            raise ValueError(f'Tracker JSONL misses source frame {missing[0]}')
        capture.set(cv2.CAP_PROP_POS_FRAMES, first)

        image_digest = hashlib.sha256()
        proposal_rows = []
        frame_records = []
        unique_ids = set()
        for source_index in range(first, last):
            ok, frame = capture.read()
            if not ok:
                raise ValueError(f'Video truncated at source frame {source_index}')
            relative = source_index - first + 1
            filename = f'{relative:06d}.jpg'
            destination = image_dir / filename
            if not cv2.imwrite(
                str(destination), frame,
                [int(cv2.IMWRITE_JPEG_QUALITY), int(jpeg_quality)],
            ):
                raise RuntimeError(f'Could not write {destination}')
            image_digest.update(filename.encode('ascii') + b'\0')
            image_digest.update(destination.read_bytes())

            row = rows[source_index]
            if row.get('frame_index') != source_index:
                raise ValueError(f'Frame mismatch at {source_index}')
            if row.get('image') != {'width': width, 'height': height}:
                raise ValueError(f'Dimension mismatch at frame {source_index}')
            expected_ms = source_index * 1000.0 / fps
            if abs(float(row.get('timestamp_ms', -1)) - expected_ms) > 1:
                raise ValueError(f'Timestamp mismatch at frame {source_index}')
            for observation in row['objects']:
                proposal_rows.append(mot_seed_row(relative, observation, width, height))
                unique_ids.add(int(observation['track_id']))
            frame_records.append([relative, source_index, round(expected_ms, 3), filename])
    finally:
        capture.release()

    seed_path = seed_dir / 'seed.txt'
    frames_path = output / 'frames.csv'
    with seed_path.open('w', newline='', encoding='utf-8') as stream:
        csv.writer(stream).writerows(proposal_rows)
    with frames_path.open('w', newline='', encoding='utf-8') as stream:
        writer = csv.writer(stream)
        writer.writerow(['task_frame', 'source_frame', 'source_timestamp_ms', 'image'])
        writer.writerows(frame_records)
    (output / 'seqinfo.ini').write_text(
        '[Sequence]\n'
        'name=ferro_lujan_contact\n'
        'imDir=img1\n'
        f'frameRate={fps:g}\n'
        f'seqLength={last-first}\n'
        f'imWidth={width}\n'
        f'imHeight={height}\n'
        'imExt=.jpg\n'
    )
    (output / 'REVIEW_REQUIRED.md').write_text(
        '# Revisión humana obligatoria\n\n'
        '`seed/seed.txt` contiene propuestas automáticas, no ground truth. '
        'Corregí todas las cajas, ausencias e identidades en todos los frames. '
        'Creá `gt/gt.txt` sólo al terminar una revisión completa e independiente. '
        'No calcules ni publiques IDF1, HOTA, MOTA o recall usando el seed.\n'
    )
    manifest = {
        'status': STATUS,
        'source_video': video.name,
        'source_video_sha256': sha256_file(video),
        'source_tracks': tracks.name,
        'source_tracks_sha256': sha256_file(tracks),
        'source_start_frame': first,
        'source_end_frame_exclusive': last,
        'source_start_seconds': start,
        'source_seconds': seconds,
        'fps': fps,
        'width': width,
        'height': height,
        'task_frames': last - first,
        'proposal_boxes': len(proposal_rows),
        'proposal_track_ids': len(unique_ids),
        'seed_sha256': sha256_file(seed_path),
        'frames_csv_sha256': sha256_file(frames_path),
        'images_sha256': image_digest.hexdigest(),
        'jpeg_quality': jpeg_quality,
        'metrics_allowed_before_review': False,
    }
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', required=True)
    parser.add_argument('--tracks', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--start', type=float, default=3.5)
    parser.add_argument('--seconds', type=float, default=3.5)
    parser.add_argument('--jpeg-quality', type=int, default=95)
    print(json.dumps(prepare(**vars(parser.parse_args())), indent=2))


if __name__ == '__main__':
    main()

"""Render 2-4 synchronized tracker outputs over the same source frames."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import unicodedata

from compare_video import load_window
from sevenmetros_ai.tracking import Detection, Track
from sevenmetros_ai.visualization import draw_tracks


def parse_track_spec(value):
    if '=' not in value:
        raise argparse.ArgumentTypeError('Use LABEL=PATH for every --tracks value')
    label, path = value.split('=', 1)
    if not label.strip() or not path.strip():
        raise argparse.ArgumentTypeError('Tracker label and path must be nonempty')
    return label.strip(), Path(path)


def display_label(value):
    """Return text OpenCV's built-in font can render predictably."""
    return unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode('ascii')


def tracks_from_row(row, *, frame_index, timestamp_ms, width, height):
    if row.get('frame_index') != frame_index:
        raise ValueError(f'Frame mismatch at {frame_index}')
    if row.get('image') != {'width': width, 'height': height}:
        raise ValueError(f'Dimension mismatch at frame {frame_index}')
    if abs(float(row.get('timestamp_ms', -1)) - timestamp_ms) > 1:
        raise ValueError(f'Timestamp mismatch at frame {frame_index}')
    return [
        Track(
            observation['track_id'],
            Detection(
                *observation['bbox_xyxy'],
                confidence=observation['confidence'],
                label=observation['kind'],
                team=observation['team'],
                role_candidate=observation.get('role_candidate'),
            ),
        )
        for observation in row['objects']
    ]


def render(video, track_specs, output, start=3.5, seconds=3.5, slowdown=2):
    import cv2
    import numpy as np

    if not 2 <= len(track_specs) <= 4:
        raise ValueError('Require between 2 and 4 tracker inputs')
    if start < 0 or seconds <= 0 or slowdown <= 0:
        raise ValueError('Invalid time range')
    paths = [Path(video).resolve(), *(path.resolve() for _, path in track_specs)]
    if Path(output).resolve() in paths:
        raise ValueError('Output must differ from every input')
    labels = [label for label, _ in track_specs]
    if len(labels) != len(set(labels)):
        raise ValueError('Tracker labels must be unique')

    capture = cv2.VideoCapture(str(video))
    process = None
    try:
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        if not capture.isOpened() or fps <= 0 or width <= 0 or height <= 0:
            raise ValueError('Invalid input video')
        first, last = int(start * fps), int((start + seconds) * fps)
        windows = [load_window(path, first, last) for _, path in track_specs]
        for (label, path), rows in zip(track_specs, windows):
            missing = [index for index in range(first, last) if index not in rows]
            if missing:
                raise ValueError(f'{label} ({path}) misses frame {missing[0]}')

        capture.set(cv2.CAP_PROP_POS_FRAMES, first)
        output_width = width * len(track_specs)
        output_height = height + 44
        process = subprocess.Popen([
            'ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
            '-s', f'{output_width}x{output_height}', '-r', str(fps / slowdown),
            '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output),
        ], stdin=subprocess.PIPE)
        for index in range(first, last):
            ok, frame = capture.read()
            if not ok:
                raise ValueError('Video truncated')
            panels = []
            for (label, _), rows in zip(track_specs, windows):
                tracks = tracks_from_row(
                    rows[index], frame_index=index,
                    timestamp_ms=index * 1000.0 / fps,
                    width=width, height=height,
                )
                panel = np.zeros((output_height, width, 3), np.uint8)
                panel[44:] = draw_tracks(frame.copy(), tracks)
                cv2.putText(
                    panel, f'{display_label(label)} | fuente t={index / fps:.2f}s',
                    (10, 29), cv2.FONT_HERSHEY_SIMPLEX, .65, (255, 255, 255), 1,
                    cv2.LINE_AA,
                )
                panels.append(panel)
            process.stdin.write(np.concatenate(panels, axis=1).tobytes())
        process.stdin.close()
        if process.wait() != 0:
            raise RuntimeError('FFmpeg failed')
        return {
            'frames_rendered': last - first,
            'source_start_seconds': start,
            'source_seconds': seconds,
            'output_fps': fps / slowdown,
            'labels': labels,
        }
    finally:
        capture.release()
        if process is not None and process.poll() is None:
            process.kill()
            process.wait()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', required=True)
    parser.add_argument('--tracks', action='append', required=True, type=parse_track_spec)
    parser.add_argument('--output', required=True)
    parser.add_argument('--start', type=float, default=3.5)
    parser.add_argument('--seconds', type=float, default=3.5)
    parser.add_argument('--slowdown', type=float, default=2)
    args = parser.parse_args()
    result = render(
        args.video, args.tracks, args.output,
        start=args.start, seconds=args.seconds, slowdown=args.slowdown,
    )
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()

"""Conservative event candidates from observed possession-candidate runs.

These helpers never turn frame-level geometry into confirmed handball events.
Only stable candidate runs are considered. A short transition between two
different stable players becomes a control-change candidate, classified only by
whether the observed team label stayed the same or changed.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CandidateRun:
    track_id: int
    team: str | None
    start_frame: int
    end_frame: int
    frames: int


@dataclass(frozen=True)
class ControlChangeCandidate:
    kind: str
    frame_index: int
    source_track_id: int
    source_team: str | None
    target_track_id: int
    target_team: str | None
    gap_frames: int
    source_run_frames: int
    target_run_frames: int


def stable_candidate_runs(rows, *, min_run_frames: int = 2) -> list[CandidateRun]:
    if isinstance(min_run_frames, bool) or int(min_run_frames) != min_run_frames or min_run_frames <= 0:
        raise ValueError("min_run_frames must be a positive integer")
    min_run_frames = int(min_run_frames)
    runs: list[CandidateRun] = []
    current = None
    previous_frame = None

    def flush():
        nonlocal current
        if current is not None and current[4] >= min_run_frames:
            runs.append(CandidateRun(*current))
        current = None

    for row in rows:
        frame = int(row["frame_index"])
        if previous_frame is not None and frame <= previous_frame:
            raise ValueError("rows must be strictly ordered by frame_index")
        previous_frame = frame
        if row.get("state") != "candidate":
            flush()
            continue
        track_id = row.get("track_id")
        if track_id is None:
            raise ValueError("candidate row requires track_id")
        track_id = int(track_id)
        team = row.get("team")
        key = (track_id, team)
        if current is not None and (current[0], current[1]) == key and frame == current[3] + 1:
            current[3] = frame
            current[4] += 1
        else:
            flush()
            current = [track_id, team, frame, frame, 1]
    flush()
    return runs


def detect_control_change_candidates(
    rows,
    *,
    min_run_frames: int = 2,
    max_transition_gap_frames: int = 4,
) -> list[ControlChangeCandidate]:
    if (
        isinstance(max_transition_gap_frames, bool)
        or int(max_transition_gap_frames) != max_transition_gap_frames
        or max_transition_gap_frames < 0
    ):
        raise ValueError("max_transition_gap_frames must be a non-negative integer")
    max_transition_gap_frames = int(max_transition_gap_frames)
    runs = stable_candidate_runs(rows, min_run_frames=min_run_frames)
    events = []
    for source, target in zip(runs, runs[1:]):
        if source.track_id == target.track_id:
            continue
        gap = target.start_frame - source.end_frame - 1
        if gap < 0 or gap > max_transition_gap_frames:
            continue
        same_team = (
            source.team is not None
            and target.team is not None
            and source.team == target.team
        )
        kind = (
            "same_team_control_change_candidate"
            if same_team
            else "opponent_control_change_candidate"
        )
        events.append(ControlChangeCandidate(
            kind=kind,
            frame_index=target.start_frame,
            source_track_id=source.track_id,
            source_team=source.team,
            target_track_id=target.track_id,
            target_team=target.team,
            gap_frames=gap,
            source_run_frames=source.frames,
            target_run_frames=target.frames,
        ))
    return events

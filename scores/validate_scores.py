#!/usr/bin/env python3
"""Validate staged scores, with optional task-specific manifest checks."""

import argparse
import csv
import io
import json
import math
import re
from datetime import datetime
from pathlib import Path


LEGACY_HEADER = (
    "listener_id", "session_id", "task_id", "round", "submission_kind",
    "submitted_at", "dataset", "sample_id", "candidate_position",
    "candidate_key", "score", "scale_max", "audio_file", "audio_url",
    "audio_sha256", "reference_file",
)
REQUIRED_COLUMNS = {
    "task_id", "session_id", "submitted_at", "sample_id",
    "candidate_key", "score", "scale_max",
}
def _timestamp(value):
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (AttributeError, ValueError) as error:
        raise ValueError("Invalid submitted_at timestamp") from error
    if parsed.tzinfo is None:
        raise ValueError("submitted_at must include a timezone")
    return parsed


def validate_csv(task_id, user_id, device_type, content, manifest=None):
    if not isinstance(task_id, str) or not re.fullmatch(r"[A-Za-z0-9]{1,20}", task_id):
        raise ValueError("task_id must contain 1-20 English letters or digits")
    if not isinstance(user_id, str) or not re.fullmatch(r"[A-Za-z0-9\u3400-\u9fff]{1,20}", user_id):
        raise ValueError("user_id must contain 1-20 Chinese, English, or numeric characters")
    if isinstance(device_type, bool) or not isinstance(device_type, int) or device_type <= 0:
        raise ValueError("device_type must be a positive integer")
    if manifest is not None and manifest.get("task_id", manifest.get("study")) != task_id:
        raise ValueError("task_id is not registered by this manifest")
    if not isinstance(content, bytes) or len(content) > 10 * 1024 * 1024:
        raise ValueError("CSV payload must be at most 10 MiB")
    try:
        reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig"), newline=""))
        fields = reader.fieldnames or []
        if (not REQUIRED_COLUMNS.issubset(fields) or
                not ({"user_id", "listener_id"} & set(fields)) or
                len(set(fields)) != len(fields)):
            raise ValueError("CSV is missing required columns or has duplicate headers")
        rows = list(reader)
    except (UnicodeDecodeError, csv.Error) as error:
        raise ValueError("CSV payload is not valid UTF-8 CSV") from error
    if not 1 <= len(rows) <= 10000:
        raise ValueError("CSV must contain 1-10000 score rows")

    by_sample = None
    if manifest is not None:
        samples = manifest.get("samples", manifest.get("trials")) or []
        by_sample = {sample["sample_id"]: sample for sample in samples}
        if not samples or len(by_sample) != len(samples):
            raise ValueError("Task manifest has duplicate sample IDs")
    seen = set()
    for index, row in enumerate(rows, 1):
        if None in row or any(value is None for value in row.values()):
            raise ValueError("CSV row {} has missing or extra columns".format(index))
        user_columns = [row[column] for column in ("user_id", "listener_id") if column in row]
        if row["task_id"] != task_id or any(value != user_id for value in user_columns):
            raise ValueError("CSV row {} identity differs from the form fields".format(index))
        if not row["session_id"] or len(row["session_id"]) > 128:
            raise ValueError("CSV row {} has an invalid session_id".format(index))
        if "submission_kind" in row and row["submission_kind"] not in {"checkpoint", "batch"}:
            raise ValueError("CSV row {} has an invalid submission_kind".format(index))
        _timestamp(row["submitted_at"])
        try:
            score = float(row["score"])
            maximum = float(row["scale_max"])
        except ValueError as error:
            raise ValueError("CSV row {} has an invalid number".format(index)) from error
        if not math.isfinite(score) or not math.isfinite(maximum) or maximum <= 0 or not 0 <= score <= maximum:
            raise ValueError("CSV row {} has an invalid score".format(index))
        if "round" in row:
            try:
                round_number = int(row["round"])
            except ValueError as error:
                raise ValueError("CSV row {} has an invalid round".format(index)) from error
            if round_number <= 0:
                raise ValueError("CSV row {} has an invalid round".format(index))
        sample_id = row["sample_id"]
        key = row["candidate_key"]
        if not 1 <= len(sample_id) <= 128 or not 1 <= len(key) <= 128:
            raise ValueError("CSV row {} needs nonempty sample_id and candidate_key".format(index))
        sample = by_sample.get(sample_id) if by_sample is not None else None
        if by_sample is not None and sample is None:
            raise ValueError("CSV row {} has an unknown sample_id".format(index))
        tracks = sample.get("tracks", {}) if sample is not None else {}
        candidates = None
        if sample is not None:
            candidates = sample.get("candidates")
            if candidates is None:
                candidates = [candidate for candidate in tracks if candidate != "reference"]
            if not isinstance(candidates, list) or not all(isinstance(candidate, str) for candidate in candidates):
                raise ValueError("Task manifest has invalid candidates")
            if key not in candidates:
                raise ValueError("CSV row {} has an unknown scored candidate_key".format(index))
        if "candidate_position" in row:
            try:
                position = int(row["candidate_position"])
            except ValueError as error:
                raise ValueError("CSV row {} has an invalid candidate_position".format(index)) from error
            if position < 1 or (candidates is not None and position > len(candidates)):
                raise ValueError("CSV row {} has an invalid candidate_position".format(index))
        if sample is not None and "dataset" in row and sample.get("dataset") and row["dataset"] != sample["dataset"]:
            raise ValueError("CSV row {} does not match the task manifest".format(index))
        if key in tracks:
            for column, field in (("audio_file", "file"), ("audio_sha256", "sha256")):
                if column in row and field in tracks[key] and row[column] != tracks[key][field]:
                    raise ValueError("CSV row {} does not match the task manifest".format(index))
            expected_reference = tracks.get("reference", {}).get("file", "")
            if "reference_file" in row and row["reference_file"] != expected_reference:
                raise ValueError("CSV row {} does not match the task manifest".format(index))
        identity = (row["sample_id"], key)
        if identity in seen:
            raise ValueError("CSV row {} repeats a candidate in one submission".format(index))
        seen.add(identity)
    return rows


def latest_by_candidate(submissions):
    """Select the latest validated row per task, listener, sample and candidate.

    Each submission is (server_received_at, submission_id, validated_rows).
    The server timestamp is authoritative; CSV submitted_at is audit metadata.
    """
    latest = {}
    for received_at, submission_id, rows in submissions:
        rank = (_timestamp(received_at), submission_id)
        for row in rows:
            key = (row["task_id"], row.get("user_id", row.get("listener_id")),
                   row["sample_id"], row["candidate_key"])
            if key not in latest or rank > latest[key][0]:
                latest[key] = (rank, row)
    return {key: value[1] for key, value in latest.items()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--task-id", required=True)
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--device-type", type=int, required=True)
    parser.add_argument("--manifest", type=Path,
                        help="Optional task manifest for sample and candidate checks")
    parser.add_argument("--csv", type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text()) if args.manifest else None
    rows = validate_csv(args.task_id, args.user_id, args.device_type,
                        args.csv.read_bytes(), manifest)
    print("validated {} score rows for {} / {}".format(len(rows), args.task_id, args.user_id))


if __name__ == "__main__":
    main()

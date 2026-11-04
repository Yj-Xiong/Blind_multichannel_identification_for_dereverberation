#!/usr/bin/env python3
"""Import completed real-recording batches from the Formspree result form."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
from collections import Counter
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError

from scores.sync_formspree import fetch_submissions, parse_page, received_at


FORM_URL = "https://formspree.io/api/0/forms/mpqgvpvo/submissions"
TASK_ID = "dereverbReal12v3"
FIELDS = ("task_id", "user_id", "session_id", "sample_id", "candidate_key",
          "score", "scale_max", "submitted_at", "received_at", "submission_id")


def fields_of(submission: dict) -> dict:
    fields = submission.get("data", submission.get("fields", submission))
    if isinstance(fields, list):
        fields = {item["name"]: item.get("value") for item in fields}
    if not isinstance(fields, dict):
        raise ValueError("submission fields are not an object")
    return fields


def extract(submission: dict, manifest: dict) -> list[dict]:
    fields = fields_of(submission)
    payload = fields.get("payloadJson")
    if not isinstance(payload, str):
        raise ValueError("missing payloadJson")
    payload = json.loads(payload)
    if payload.get("taskId", payload.get("study")) != TASK_ID or payload.get("study") != TASK_ID:
        return []
    if payload.get("submissionKind") != "batch":
        return []
    if payload.get("audioVersion") != manifest["audio_version"] or payload.get("datasetVersion") != manifest["dataset_version"]:
        raise ValueError("task or audio version mismatch")
    user = payload.get("userId", payload.get("listenerId"))
    if not isinstance(user, str) or not user or user != payload.get("listenerId"):
        raise ValueError("invalid listener ID")
    if fields.get("user_id", user) != user or fields.get("task_id", TASK_ID) != TASK_ID:
        raise ValueError("outer and payload identities differ")
    session = payload.get("sessionId")
    if not isinstance(session, str) or not session:
        raise ValueError("missing session ID")
    scores = payload.get("scores")
    if not isinstance(scores, dict):
        raise ValueError("missing score map")
    trials = {trial["sample_id"]: trial for trial in manifest["trials"]}
    received = received_at(submission)
    submitted = payload.get("submittedAt", "")
    if not isinstance(submitted, str) or not submitted:
        raise ValueError("missing submission time")
    identifier = str(submission.get("id") or submission.get("_id") or "")
    if not identifier:
        identifier = hashlib.sha256((received + payload["sessionId"] + submitted).encode()).hexdigest()
    result = []
    for sample_id, candidate_scores in scores.items():
        trial = trials.get(sample_id)
        if trial is None or not isinstance(candidate_scores, dict):
            raise ValueError("unknown sample or invalid scores")
        expected = set(trial["tracks"]) - {"reference"}
        if set(candidate_scores) != expected:
            continue  # A cumulative payload can contain a partially rated next batch.
        for candidate, value in candidate_scores.items():
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 100:
                raise ValueError("score outside 0-100")
            result.append(dict(task_id=TASK_ID, user_id=user, session_id=session,
                               sample_id=sample_id, candidate_key=candidate,
                               score=value, scale_max=100, submitted_at=submitted,
                               received_at=received, submission_id=identifier))
    return result


def sync(submissions: list[dict], manifest: dict, output: Path) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    latest = {}
    reasons = Counter()
    accepted_submissions = 0
    for submission in submissions:
        try:
            rows = extract(submission, manifest)
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            reasons[str(error).split(":", 1)[0][:100]] += 1
            continue
        if not rows:
            continue
        accepted_submissions += 1
        for row in rows:
            key = row["user_id"], row["sample_id"], row["candidate_key"]
            rank = (datetime.fromisoformat(row["received_at"].replace("Z", "+00:00")), row["submission_id"])
            if key not in latest or rank > latest[key][0]:
                latest[key] = rank, row
    with (output / "real_result_latest.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(row for _, row in (latest[key] for key in sorted(latest)))
    status = {"received": len(submissions), "accepted_submissions": accepted_submissions,
              "latest_scores": len(latest), "listeners": len({key[0] for key in latest}),
              "rejected_reasons": dict(sorted(reasons.items()))}
    (output / "real_result_sync_status.json").write_text(json.dumps(status, indent=2) + "\n")
    return status


def main() -> None:
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--api", action="store_true")
    source.add_argument("--input", type=Path)
    parser.add_argument("--output", type=Path, default=Path("scores"))
    args = parser.parse_args()
    manifest = json.loads(Path("p808/real12_lufs_manifest.json").read_text())
    if args.api:
        try:
            submissions = fetch_submissions(FORM_URL, os.environ.get("FORMSPREE_RESULTS_READ_ONLY_KEY", ""))
        except HTTPError as error:
            if error.code not in (401, 403):
                raise
            args.output.mkdir(parents=True, exist_ok=True)
            status = {"status": "results_form_read_key_required", "http_status": error.code}
            (args.output / "real_result_sync_status.json").write_text(json.dumps(status, indent=2) + "\n")
            print(json.dumps(status))
            return
    else:
        submissions, _ = parse_page(args.input.read_bytes())
    print(json.dumps(sync(submissions, manifest, args.output), ensure_ascii=False))


if __name__ == "__main__":
    main()

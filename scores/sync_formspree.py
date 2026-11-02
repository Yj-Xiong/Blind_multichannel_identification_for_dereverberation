#!/usr/bin/env python3
"""Import staged Formspree CSV fields into the public score archive."""

import argparse
import base64
import csv
import hashlib
import io
import json
import os
import re
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen

from scores.validate_scores import latest_by_candidate, validate_csv


LATEST_FIELDS = (
    "task_id", "user_id", "session_id", "sample_id", "candidate_key",
    "score", "scale_max", "submitted_at", "received_at", "submission_id",
)
DEFAULT_API_URL = "https://formspree.io/api/0/forms/mjyypvzy/submissions"


def parse_page(content):
    text = content.decode("utf-8-sig")
    if text.lstrip().startswith(("[", "{")):
        document = json.loads(text)
        if isinstance(document, list):
            return document, None
        for key in ("submissions", "results", "data"):
            value = document.get(key)
            if isinstance(value, list):
                next_url = document.get("next") or (document.get("links") or {}).get("next")
                if isinstance(next_url, dict):
                    next_url = next_url.get("href")
                return value, next_url
        raise ValueError("Formspree response has no submissions list")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or not {"task_id", "user_id", "scores_csv"}.issubset(reader.fieldnames):
        raise ValueError("Formspree CSV export is missing staging fields")
    return list(reader), None


def fetch_submissions(url, key):
    if not key:
        raise ValueError("FORMSPREE_STAGING_READ_ONLY_KEY is not set")
    start = urlparse(url)
    if start.scheme != "https" or not start.netloc:
        raise ValueError("Formspree export URL must be HTTPS")
    authorization = "Basic " + base64.b64encode((":" + key).encode("utf-8")).decode("ascii")
    submissions = []
    limit = 100
    for page_number in range(1000):
        query = dict(parse_qsl(start.query, keep_blank_values=True))
        query.update({"limit": str(limit), "offset": str(page_number * limit), "order": "asc"})
        page_url = urlunparse(start._replace(query=urlencode(query)))
        request = Request(page_url, headers={
            "Accept": "application/json, text/csv",
            "Authorization": authorization,
        })
        with urlopen(request, timeout=60) as response:
            page, _ = parse_page(response.read())
        submissions.extend(page)
        if len(page) < limit:
            return submissions
    raise ValueError("Formspree export exceeds 1000 pages")


def submission_fields(submission):
    fields = submission.get("data", submission.get("fields", submission))
    if isinstance(fields, list):
        fields = {item["name"]: item.get("value") for item in fields}
    if not isinstance(fields, dict):
        raise ValueError("Submission fields are not an object")
    required = ("task_id", "user_id", "device_type", "scores_csv")
    if any(key not in fields for key in required):
        raise ValueError("Submission is missing a staging field")
    return {key: fields[key] for key in required}


def received_at(submission):
    for key in ("_date", "created_at", "createdAt", "created", "submitted_at", "timestamp"):
        value = submission.get(key)
        if isinstance(value, str) and value:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                return value + "Z"
            return value
    raise ValueError("Submission has no server receipt time")


def archive(submissions, output):
    inbox = output / "inbox"
    inbox.mkdir(parents=True, exist_ok=True)
    added = rejected = 0
    for submission in submissions:
        try:
            fields = submission_fields(submission)
            when = received_at(submission)
            device_type = int(fields["device_type"])
            csv_text = fields["scores_csv"]
            if not isinstance(csv_text, str):
                raise ValueError("scores_csv is not a text field")
            csv_bytes = csv_text.encode("utf-8")
            validate_csv(fields["task_id"], fields["user_id"], device_type, csv_bytes)
            source_id = str(submission.get("id") or submission.get("_id") or submission.get("uuid") or "")
            canonical = json.dumps([source_id, when, fields], ensure_ascii=False, sort_keys=True)
            identifier = source_id if re.fullmatch(r"[A-Za-z0-9_.-]{1,120}", source_id) else hashlib.sha256(canonical.encode()).hexdigest()
            raw = inbox / (identifier + ".json")
            scores = inbox / (identifier + ".csv")
            record = {"submission_id": identifier, "received_at": when,
                      "task_id": fields["task_id"], "user_id": fields["user_id"],
                      "device_type": device_type, "csv_sha256": hashlib.sha256(csv_bytes).hexdigest()}
            if raw.exists():
                if json.loads(raw.read_text()) != record or scores.read_bytes() != csv_bytes:
                    raise ValueError("Existing submission ID has changed content")
                continue
            raw.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")
            scores.write_bytes(csv_bytes)
            added += 1
        except (KeyError, TypeError, ValueError) as error:
            rejected += 1
            print("Rejected Formspree submission {}: {}".format(submission.get("id", "unknown"), error))

    validated = []
    provenance = {}
    for raw in sorted(inbox.glob("*.json")):
        record = json.loads(raw.read_text())
        csv_bytes = raw.with_suffix(".csv").read_bytes()
        if hashlib.sha256(csv_bytes).hexdigest() != record["csv_sha256"]:
            raise ValueError("Archived CSV hash changed: " + raw.name)
        rows = validate_csv(record["task_id"], record["user_id"], record["device_type"], csv_bytes)
        validated.append((record["received_at"], record["submission_id"], rows))
        for row in rows:
            provenance[id(row)] = (record["received_at"], record["submission_id"])
    latest = latest_by_candidate(validated)
    with (output / "latest.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=LATEST_FIELDS)
        writer.writeheader()
        for key, row in sorted(latest.items()):
            received_time, submission_id = provenance[id(row)]
            values = {"task_id": key[0], "user_id": key[1],
                      "session_id": row["session_id"], "sample_id": key[2],
                      "candidate_key": key[3], "score": row["score"],
                      "scale_max": row["scale_max"], "submitted_at": row["submitted_at"],
                      "received_at": received_time, "submission_id": submission_id}
            writer.writerow({name: "'" + value if isinstance(value, str) and
                             value.lstrip().startswith(("=", "+", "-", "@")) else value
                             for name, value in values.items()})
    return added, rejected, len(latest)


def main():
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--input", type=Path, help="Local Formspree JSON or CSV export")
    source.add_argument("--api", action="store_true", help="Fetch all staging-form submissions")
    parser.add_argument("--output", type=Path, default=Path("scores"))
    args = parser.parse_args()
    if args.input:
        submissions, _ = parse_page(args.input.read_bytes())
    else:
        url = os.environ.get("FORMSPREE_STAGING_EXPORT_URL", DEFAULT_API_URL)
        submissions = fetch_submissions(url, os.environ.get("FORMSPREE_STAGING_READ_ONLY_KEY", ""))
    added, rejected, latest = archive(submissions, args.output)
    print("received={} added={} rejected={} latest_scores={}".format(
        len(submissions), added, rejected, latest))


if __name__ == "__main__":
    try:
        main()
    except HTTPError as error:
        raw = error.read().decode("utf-8", "replace")
        try:
            body = json.loads(raw)
            detail = str(body.get("error") or body.get("message") or body.get("errors") or "")
        except (AttributeError, ValueError):
            detail = raw
        key = os.environ.get("FORMSPREE_STAGING_READ_ONLY_KEY", "")
        if key:
            detail = detail.replace(key, "[redacted]")
        detail = re.sub(r"\b[0-9a-fA-F]{32}\b", "[redacted]", detail)
        detail = detail.replace("\n", " ")[:180]
        print("::error title=Formspree submissions API::HTTP {} {}".format(error.code, detail))
        raise
    except Exception as error:
        print("::error title=Formspree score sync::{}: {}".format(
            type(error).__name__, str(error).replace("\n", " ")[:180]))
        raise

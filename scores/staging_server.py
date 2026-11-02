#!/usr/bin/env python3
"""Small staging endpoint for public subjective-score archives.

Run this beside a checkout of the repository. Set P808_AUTO_COMMIT=1 only on a
machine with a dedicated GitHub deploy key if every accepted request should be
committed and pushed immediately.
"""

import argparse
import csv
import hashlib
import json
import os
import re
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from scores.validate_scores import validate_csv


ROOT = Path(__file__).resolve().parent
INBOX = ROOT / "inbox"
ARCHIVE_LOCK = threading.Lock()


def validate(request):
    if not isinstance(request, dict) or set(request) != {"task_id", "user_id", "device_type", "scores_csv"}:
        raise ValueError("request must contain task_id, user_id, device_type, scores_csv")
    task_id = request["task_id"]
    user_id = request["user_id"]
    device_type = request["device_type"]
    scores_csv = request["scores_csv"]
    if not isinstance(task_id, str) or not re.fullmatch(r"[A-Za-z0-9]{1,20}", task_id):
        raise ValueError("task_id must contain 1-20 English letters or digits")
    if not isinstance(user_id, str) or not re.fullmatch(r"[A-Za-z0-9\u3400-\u9fff]{1,20}", user_id):
        raise ValueError("user_id must contain 1-20 Chinese, English, or numeric characters")
    if isinstance(device_type, bool) or not isinstance(device_type, int) or device_type <= 0:
        raise ValueError("device_type must be a positive integer")
    if not isinstance(scores_csv, str) or len(scores_csv.encode("utf-8")) > 10 * 1024 * 1024:
        raise ValueError("scores_csv must be UTF-8 text no larger than 10 MiB")
    return validate_csv(task_id, user_id, device_type, scores_csv.encode("utf-8"))


def archive(request):
    rows = validate(request)
    canonical = json.dumps(request, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    with ARCHIVE_LOCK:
        INBOX.mkdir(parents=True, exist_ok=True)
        stem = "{}-{}-{}".format(request["task_id"], request["user_id"], digest[:16])
        raw = INBOX / (stem + ".json")
        csv_path = INBOX / (stem + ".csv")
        if not raw.exists():
            raw.write_text(json.dumps(request, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            with csv_path.open("w", newline="", encoding="utf-8") as stream:
                writer = csv.DictWriter(stream, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)
        if os.environ.get("P808_AUTO_COMMIT") == "1":
            repository = ROOT.parent
            subprocess.run(["git", "add", str(raw), str(csv_path)], cwd=repository, check=True)
            staged = subprocess.run(["git", "diff", "--cached", "--quiet", "--", str(raw), str(csv_path)], cwd=repository)
            if staged.returncode == 1:
                subprocess.run(["git", "commit", "-m", "Archive staged listening scores"], cwd=repository, check=True)
            subprocess.run(["git", "push"], cwd=repository, check=True)
    return digest, len(rows), (Path("scores") / "inbox" / raw.name).as_posix()


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.end_headers()

    def do_POST(self):
        if self.path != "/stage":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 12 * 1024 * 1024:
                raise ValueError("request body is empty or too large")
            request = json.loads(self.rfile.read(length).decode("utf-8"))
            digest, row_count, path = archive(request)
            body = {"ok": True, "submission_id": digest, "rows": row_count, "path": path}
            status = 200
        except (ValueError, json.JSONDecodeError) as error:
            body = {"ok": False, "error": str(error)}
            status = 400
        except Exception as error:
            body = {"ok": False, "error": str(error)}
            status = 500
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format, *args):
        print("[staging]", format % args, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()
    print("listening on http://{}:{}/stage".format(args.bind, args.port), flush=True)
    ThreadingHTTPServer((args.bind, args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()

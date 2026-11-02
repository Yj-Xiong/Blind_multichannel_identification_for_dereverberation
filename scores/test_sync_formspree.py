import csv
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scores.sync_formspree import archive, fetch_submissions, parse_page


EXAMPLE = (Path(__file__).resolve().parent / "example_scores.csv").read_text()


def submission(when, scores_csv=EXAMPLE):
    return {"_date": when, "task_id": "task20261102", "user_id": "测试者01",
            "device_type": "1", "scores_csv": scores_csv}


class Response:
    def __init__(self, payload):
        self.payload = json.dumps(payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self):
        return self.payload


class FormspreeSyncTests(unittest.TestCase):
    def test_documented_api_response(self):
        body = {"fields": ["_date", "task_id", "scores_csv"],
                "submissions": [submission("2026-11-02T10:00:00.000000")]}
        rows, next_url = parse_page(json.dumps(body).encode("utf-8"))
        self.assertEqual(len(rows), 1)
        self.assertIsNone(next_url)

    def test_http_basic_and_offset_pagination(self):
        calls = []

        def fake_urlopen(request, timeout):
            calls.append(request)
            count = 100 if len(calls) == 1 else 1
            return Response({"submissions": [submission("2026-11-02T10:00:00") for _ in range(count)]})

        with patch("scores.sync_formspree.urlopen", side_effect=fake_urlopen):
            rows = fetch_submissions("https://formspree.io/api/0/forms/form1/submissions", "test-key")
        self.assertEqual(len(rows), 101)
        self.assertIn("offset=0", calls[0].full_url)
        self.assertIn("offset=100", calls[1].full_url)
        self.assertEqual(calls[0].get_header("Authorization"), "Basic OnRlc3Qta2V5")

    def test_archive_uses_formspree_date_and_is_idempotent(self):
        first = submission("2026-11-02T10:00:00.000000")
        second = submission("2026-11-02T11:00:00.000000", EXAMPLE.replace(",76,100", ",80,100"))
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder)
            self.assertEqual(archive([first, second], output), (2, 0, 2))
            with (output / "latest.csv").open(newline="", encoding="utf-8") as stream:
                rows = {row["candidate_key"]: row for row in csv.DictReader(stream)}
            self.assertEqual(rows["methodA"]["score"], "80")
            self.assertEqual(rows["methodA"]["received_at"], "2026-11-02T11:00:00.000000Z")
            self.assertEqual(archive([first, second], output), (0, 0, 2))

    def test_new_task_needs_no_manifest(self):
        unknown = submission("2026-11-02T10:00:00.000000",
                             EXAMPLE.replace("task20261102", "newTask1")
                             .replace("sample001", "newSample"))
        unknown["task_id"] = "newTask1"
        with tempfile.TemporaryDirectory() as folder:
            self.assertEqual(archive([unknown], Path(folder)), (1, 0, 2))

    def test_mixed_task_csv_is_rejected(self):
        invalid = submission("2026-11-02T10:00:00.000000",
                             EXAMPLE.replace("task20261102", "anotherTask", 1))
        with tempfile.TemporaryDirectory() as folder:
            self.assertEqual(archive([invalid], Path(folder)), (0, 1, 0))


if __name__ == "__main__":
    unittest.main()

import csv
import io
import json
import unittest
from pathlib import Path

from scores.validate_scores import LEGACY_HEADER, latest_by_candidate, registered_manifest, validate_csv


MANIFEST = json.loads((Path(__file__).resolve().parent.parent / "p808/short28_manifest.json").read_text())
TASK = MANIFEST["study"]
USER = "测试者01"
TRIAL = MANIFEST["trials"][0]


def row(key="unprocessed", score="42"):
    track = TRIAL["tracks"][key]
    return dict(zip(LEGACY_HEADER, (
        USER, "session001", TASK, "1", "checkpoint", "2026-11-02T10:00:00Z",
        TRIAL["dataset"], TRIAL["sample_id"], "1", key, score, "100",
        track["file"], "https://example.test/audio.mp3", track["sha256"],
        TRIAL["tracks"]["reference"]["file"],
    )))


def attachment(rows):
    stream = io.StringIO()
    writer = csv.DictWriter(stream, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue().encode("utf-8")


class ScoreValidationTests(unittest.TestCase):
    def validate(self, rows, task=TASK):
        return validate_csv(task, USER, 1, attachment(rows), MANIFEST)

    def test_known_sample_and_candidate(self):
        self.assertEqual(len(self.validate([row()])), 1)

    def test_generic_task_with_minimal_score_columns(self):
        manifest = registered_manifest("task20261102")
        score = {"task_id": "task20261102", "user_id": USER,
                 "session_id": "session001", "submitted_at": "2026-11-02T10:00:00Z",
                 "sample_id": "sample001", "candidate_key": "methodA",
                 "score": "76", "scale_max": "100"}
        rows = validate_csv("task20261102", USER, 1, attachment([score]), manifest)
        self.assertEqual(rows[0]["candidate_key"], "methodA")
        score["candidate_key"] = "unknown"
        with self.assertRaisesRegex(ValueError, "candidate_key"):
            validate_csv("task20261102", USER, 1, attachment([score]), manifest)

    def test_unknown_sample_is_rejected(self):
        invalid = row()
        invalid["sample_id"] = "ace_missing"
        with self.assertRaisesRegex(ValueError, "unknown sample_id"):
            self.validate([invalid])

    def test_unknown_or_public_reference_candidate_is_rejected(self):
        for key in ("missing-model", "reference"):
            invalid = row()
            invalid["candidate_key"] = key
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "candidate_key"):
                self.validate([invalid])

    def test_every_csv_task_must_match_outer_task(self):
        invalid = row("cleanmel-offline-l-map")
        invalid["task_id"] = "anotherTask"
        with self.assertRaisesRegex(ValueError, "identity differs"):
            self.validate([row(), invalid])

    def test_outer_task_must_match_registered_manifest(self):
        with self.assertRaisesRegex(ValueError, "not registered"):
            self.validate([row()], task="anotherTask")

    def test_repeat_candidate_in_one_attachment_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "repeats a candidate"):
            self.validate([row(), row(score="50")])

    def test_latest_uses_server_time_and_ignores_session_for_identity(self):
        earlier = self.validate([row()])
        later_row = row(score="73")
        later_row["session_id"] = "session002"
        later_row["submitted_at"] = "2026-11-01T10:00:00Z"
        later = self.validate([later_row])
        latest = latest_by_candidate([
            ("2026-11-02T10:00:00Z", "first", earlier),
            ("2026-11-02T11:00:00Z", "second", later),
        ])
        self.assertEqual(len(latest), 1)
        self.assertEqual(next(iter(latest.values()))["score"], "73")


if __name__ == "__main__":
    unittest.main()

"""Contract checks for result-form imports and condition correlations."""

import csv
import json
import tempfile
import unittest
from pathlib import Path

from scores.sync_real_result_form import extract, sync


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "p808/real12_lufs_manifest.json").read_text())


def submission(score, when, task="dereverbReal12v3"):
    trial = MANIFEST["trials"][0]
    values = {key: score for key in trial["tracks"] if key != "reference"}
    payload = {
        "taskId": task, "study": task, "submissionKind": "batch",
        "audioVersion": MANIFEST["audio_version"],
        "datasetVersion": MANIFEST["dataset_version"],
        "userId": "listener1", "listenerId": "listener1",
        "sessionId": "session1", "submittedAt": when,
        "scores": {trial["sample_id"]: values},
    }
    return {"_date": when, "data": {"user_id": "listener1",
            "task_id": task, "payloadJson": json.dumps(payload)}}


class RealResultSyncTests(unittest.TestCase):
    def test_latest_batch_wins_and_old_version_is_excluded(self):
        records = [submission(50, "2026-11-04T10:00:00Z"),
                   submission(70, "2026-11-04T10:10:00Z"),
                   submission(10, "2026-11-04T10:20:00Z", "dereverbReal12v2")]
        with tempfile.TemporaryDirectory() as folder:
            status = sync(records, MANIFEST, Path(folder))
            with (Path(folder) / "real_result_latest.csv").open() as stream:
                rows = list(csv.DictReader(stream))
        self.assertEqual(status["accepted_submissions"], 2)
        self.assertEqual(len(rows), 10)
        self.assertEqual({row["score"] for row in rows}, {"70"})

    def test_rejects_audio_version_change(self):
        record = submission(50, "2026-11-04T10:00:00Z")
        payload = json.loads(record["data"]["payloadJson"])
        payload["audioVersion"] = {"REAL": "old-version"}
        record["data"]["payloadJson"] = json.dumps(payload)
        with self.assertRaisesRegex(ValueError, "audio version mismatch"):
            extract(record, MANIFEST)


if __name__ == "__main__":
    unittest.main()

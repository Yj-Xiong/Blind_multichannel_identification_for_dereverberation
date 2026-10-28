#!/usr/bin/env python3
"""Split the full manifest into a small index and lazy-loaded batch manifests."""

import json
import random
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "batch_manifest.json"
INDEX = ROOT / "batch_index.json"
SHARDS = ROOT / "batches"
BATCH_SIZE = 15


def main():
    source = json.loads(SOURCE.read_text())
    trials = list(source["trials"])
    random.Random(808).shuffle(trials)
    batches = [trials[offset:offset + BATCH_SIZE]
               for offset in range(0, len(trials), BATCH_SIZE)]
    SHARDS.mkdir(exist_ok=True)
    for old in SHARDS.glob("batch-*.json"):
        old.unlink()
    for number, batch in enumerate(batches, 1):
        payload = {
            "study": source["study"],
            "audio_version": source["audio_version"],
            "dataset_version": source["dataset_version"],
            "models": source["models"],
            "trials": batch,
        }
        (SHARDS / f"batch-{number:03d}.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    index = {
        "study": source["study"],
        "audio_version": source["audio_version"],
        "dataset_version": source["dataset_version"],
        "models": source["models"],
        "sample_count": len(trials),
        "batch_size": BATCH_SIZE,
        "batches": [[trial["sample_id"] for trial in batch] for batch in batches],
        "trials": [{
            "sample_id": trial["sample_id"],
            "dataset": trial["dataset"],
            "scene_id": trial["scene_id"],
            "room": trial["room"],
            "array_type": trial["array_type"],
            "snr_db": trial["snr_db"],
        } for trial in trials],
    }
    INDEX.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n")
    print("index", INDEX.stat().st_size, "bytes", "batches", len(batches))
    print("shards", sum(path.stat().st_size for path in SHARDS.glob("batch-*.json")))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Verify the independent short-batch manifest and all level-matched audio."""

import argparse
import hashlib
import json
from pathlib import Path


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads((args.site / "batch_manifest.json").read_text())
    report = json.loads((args.site / "all_loudness_report.json").read_text())
    assert manifest["study"] == "dereverb-p808-batch-v1"
    assert manifest["audio_version"] == "all-rms27-peak1p5-v1"
    assert len(manifest["trials"]) == 163
    assert len({trial["sample_id"] for trial in manifest["trials"]}) == 163
    assert len(report["tracks"]) == 163 * 11
    for trial in manifest["trials"]:
        assert len(trial["tracks"]) == 11
        for item in trial["tracks"].values():
            path = args.site / item["file"]
            assert path.is_file() and path.stat().st_size > 0
            assert digest(path) == item["sha256"], path
    levels = [row["result_rms_dbfs"] for row in report["tracks"] if row["result_rms_dbfs"] is not None]
    print("trials", len(manifest["trials"]), "tracks", len(report["tracks"]))
    print("rms_dbfs", min(levels), max(levels), "peak_limited", sum(row["peak_limited"] for row in report["tracks"]))


if __name__ == "__main__":
    main()

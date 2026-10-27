#!/usr/bin/env python3
"""Verify the AIR audio revision without changing any ACE trial."""

import argparse
import hashlib
import json
from pathlib import Path


VERSION = "air-rms27-peak1p5-v1"


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, required=True)
    args = parser.parse_args()
    current = json.loads((args.site / "manifest.json").read_text())
    baseline = json.loads(args.baseline.read_text())
    report = json.loads((args.site / "air_loudness_report.json").read_text())
    ace = [trial for trial in current["trials"] if trial["dataset"] == "ACE"]
    old_ace = [trial for trial in baseline["trials"] if trial["dataset"] == "ACE"]
    air = [trial for trial in current["trials"] if trial["dataset"] == "AIR"]
    assert ace == old_ace and len(ace) == 56
    assert len(air) == 107 and len(current["trials"]) == 163
    assert current["audio_version"]["AIR"] == VERSION
    assert len(report["tracks"]) == 107 * 11
    for trial in air:
        assert len(trial["tracks"]) == 11
        assert trial["tracks"]["reference"]["sha256"] == trial["tracks"]["hidden_reference"]["sha256"]
        for track in trial["tracks"].values():
            assert track["file"].startswith(f"audio/{VERSION}/")
            path = args.site / track["file"]
            assert path.is_file() and path.stat().st_size > 0
            assert digest(path) == track["sha256"], path
    limited = sum(row["peak_limited"] for row in report["tracks"])
    levels = [row["result_rms_dbfs"] for row in report["tracks"]
              if row["result_rms_dbfs"] is not None]
    print("ACE unchanged", len(ace))
    print("AIR verified", len(air), "tracks", len(report["tracks"]))
    print("peak limited", limited, "of", len(levels))
    print("source predicted RMS dBFS", min(levels), max(levels))


if __name__ == "__main__":
    main()

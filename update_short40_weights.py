#!/usr/bin/env python3
"""Reweight new-listener sampling from archived short40 score coverage."""

import argparse
import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SELECTION = ROOT / "p808" / "short40_selection.json"
NOISY = ROOT / "p808" / "real_noisy_5to20db_v1" / "manifest.json"
OUTPUT = ROOT / "p808" / "short40_allocation_weights.json"
STUDY = "dereverb-p808-short40-v1"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--latest-csv", type=Path, required=True)
    parser.add_argument("--strength", type=float, default=1.0,
                        help="0 keeps equal weights; 1 weights by inverse coverage + 1")
    args = parser.parse_args()
    if not 0 <= args.strength <= 2:
        parser.error("strength must be between 0 and 2")
    selection = json.loads(SELECTION.read_text())
    real = json.loads(NOISY.read_text())
    ids = selection["ace_sample_ids"] + selection["air_sample_ids"] + [
        item["sample_id"] for item in real["samples"]]
    if len(ids) != 40 or len(set(ids)) != 40:
        raise ValueError("Expected 40 distinct sample IDs")
    listeners = defaultdict(set)
    with args.latest_csv.open(newline="", encoding="utf-8-sig") as stream:
        for row in csv.DictReader(stream):
            if row["study"] == STUDY and row["sample_id"] in ids and row["score"]:
                listeners[row["sample_id"]].add(row["listener_id"])
    counts = {sample_id: len(listeners[sample_id]) for sample_id in ids}
    raw_weights = {sample_id: (count + 1) ** (-args.strength)
                   for sample_id, count in counts.items()}
    mean = sum(raw_weights.values()) / len(raw_weights)
    weights = {sample_id: round(min(5.0, max(0.2, value / mean)), 6)
               for sample_id, value in raw_weights.items()}
    version_data = json.dumps({"counts": counts, "strength": args.strength},
                              sort_keys=True, separators=(",", ":"))
    version = "coverage-" + hashlib.sha256(version_data.encode()).hexdigest()[:12]
    OUTPUT.write_text(json.dumps({"allocation_version": version,
                                  "default_weight": 1.0,
                                  "source_study": STUDY,
                                  "strength": args.strength,
                                  "distinct_listener_counts": counts,
                                  "sample_weights": weights},
                                 indent=2, ensure_ascii=False) + "\n")
    print("allocation_version", version, "coverage", min(counts.values()),
          "to", max(counts.values()), "weights", min(weights.values()),
          "to", max(weights.values()))


if __name__ == "__main__":
    main()

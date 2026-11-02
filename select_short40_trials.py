#!/usr/bin/env python3
"""Select a fixed, diverse 14 ACE + 14 AIR panel for the short study."""

import hashlib
import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "p808" / "batch_manifest.json"
OUTPUT = ROOT / "p808" / "short40_selection.json"
AIR_ROOMS = {
    "aula_carolina": 1, "booth": 1, "lecture": 2, "meeting": 2,
    "office": 1, "stairway": 4, "bathroom": 1, "corridor": 1,
    "kitchen": 1,
}


def rank(trial):
    return hashlib.sha256(("p808-short40-v1:" + trial["sample_id"]).encode()).hexdigest()


def main():
    source = json.loads(SOURCE.read_text())
    ace = sorted((trial for trial in source["trials"]
                  if trial["dataset"] == "ACE" and trial["snr_db"] == 10),
                 key=lambda trial: trial["sample_id"])
    if len(ace) != 14 or len({trial["scene_id"] for trial in ace}) != 14:
        raise ValueError("ACE must provide 14 distinct 10 dB scenes")
    used_references = {trial["tracks"]["reference"]["sha256"] for trial in ace}
    by_room = defaultdict(list)
    for trial in source["trials"]:
        if trial["dataset"] == "AIR" and trial["snr_db"] == 20:
            by_room[trial["room"]].append(trial)
    air = []
    for room, count in AIR_ROOMS.items():
        candidates = sorted(by_room[room], key=rank)
        chosen = []
        for trial in candidates:
            reference = trial["tracks"]["reference"]["sha256"]
            if reference not in used_references:
                chosen.append(trial)
                used_references.add(reference)
                if len(chosen) == count:
                    break
        if len(chosen) != count:
            raise ValueError("Insufficient distinct AIR references in " + room)
        air.extend(chosen)
    air.sort(key=lambda trial: trial["sample_id"])
    if len(air) != 14 or len({trial["scene_id"] for trial in air}) != 14:
        raise ValueError("AIR must provide 14 distinct 20 dB scenes")
    selected = ace + air
    output = {"schema": "se.subjective.short40_selection.v1",
              "study": "dereverb-p808-short40-v1",
              "dataset_version": "v1.0.1",
              "ace_snr_db": 10, "air_snr_db": 20,
              "ace_sample_ids": [trial["sample_id"] for trial in ace],
              "air_sample_ids": [trial["sample_id"] for trial in air],
              "air_room_counts": AIR_ROOMS,
              "reference_sha256_unique": len(used_references)}
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print("ACE", len(ace), "AIR", len(air), "unique references", len(used_references))
    print("AIR", ", ".join(output["air_sample_ids"]))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Package the selected 28 paired and 12 no-reference listening trials."""

import argparse
import hashlib
import json
import math
import os
import subprocess
import tempfile
import uuid
from pathlib import Path

import numpy as np
import soundfile as sf


ROOT = Path(__file__).resolve().parent
P808 = ROOT / "p808"
SOURCE = P808 / "batch_manifest.json"
SELECTION = P808 / "short40_selection.json"
ALLOCATION = P808 / "short40_allocation_weights.json"
REAL = P808 / "real_noisy_5to20db_v1" / "manifest.json"
INFERENCE = P808 / "real_inference"
OUTPUT = P808 / "short40_manifest.json"
AUDIO_VERSION = "real-noisy-5to20db-rms27-v1"
MODELS = (
    "cleanmel-offline-l-map", "vinp-ospatialnet", "vinp-tcnsas",
    "dytswig-mamba-ccfaatc", "unipase", "buddy-official",
    "mc-buddy", "usddps",
)


def digest(path):
    sha = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            sha.update(block)
    return sha.hexdigest()


def gain_for(path):
    audio, rate = sf.read(path, dtype="float32", always_2d=True)
    if rate != 16000 or len(audio) != 160000 or not np.isfinite(audio).all():
        raise ValueError("Invalid input audio: " + str(path))
    mono = audio[:, 0].astype(np.float64)
    rms = float(np.sqrt(np.mean(mono ** 2)))
    peak = float(np.max(np.abs(mono)))
    if rms <= 1e-8 or peak <= 1e-8:
        raise ValueError("Silent input audio: " + str(path))
    target = 10 ** (-27 / 20) / rms
    limit = 10 ** (-1.5 / 20) / peak
    return min(target, limit)


def encode(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_file():
        if destination.stat().st_size <= 0:
            raise ValueError("Empty existing MP3: " + str(destination))
        return
    temporary = destination.with_name(destination.stem + "." + uuid.uuid4().hex + ".mp3")
    try:
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin",
                        "-y", "-i", str(source), "-af",
                        "pan=mono|c0=c0,volume={:.12g}".format(gain_for(source)),
                        "-ar", "16000", "-codec:a", "libmp3lame", "-b:a", "64k",
                        str(temporary)], check=True)
        if temporary.stat().st_size <= 0:
            raise ValueError("MP3 encoding produced an empty file")
        os.replace(temporary, destination)
    finally:
        if temporary.exists():
            temporary.unlink()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prepare-available", action="store_true",
                        help="Pre-encode finished models while remaining inference runs")
    args = parser.parse_args()
    source = json.loads(SOURCE.read_text())
    selection = json.loads(SELECTION.read_text())
    real = json.loads(REAL.read_text())
    if args.prepare_available:
        count = 0
        for item in real["samples"]:
            sample_id = item["sample_id"]
            sources = {"unprocessed": Path(item["noisy_audio"])}
            for model in MODELS:
                candidate = INFERENCE / model / Path(item["source"]).name
                if candidate.is_file() and (INFERENCE / model / "progress.json").is_file():
                    sources[model] = candidate
            for key, path in sources.items():
                target = P808 / "audio" / AUDIO_VERSION / sample_id / (key + ".mp3")
                encode(path, target)
                count += 1
        print("pre-encoded", count, "tracks", flush=True)
        return
    allocation = json.loads(ALLOCATION.read_text())
    ids = set(selection["ace_sample_ids"] + selection["air_sample_ids"])
    selected = [trial for trial in source["trials"] if trial["sample_id"] in ids]
    if len(selected) != 28 or len(ids) != 28:
        raise ValueError("Expected 28 unique selected paired trials")
    for trial in selected:
        for track in trial["tracks"].values():
            path = P808 / track["file"]
            if not path.is_file() or digest(path) != track["sha256"]:
                raise ValueError("Missing or changed paired audio: " + str(path))
    if len(real["samples"]) != 12:
        raise ValueError("Expected 12 real recordings")
    for item in real["samples"]:
        sample_id = item["sample_id"]
        source_audio = Path(item["noisy_audio"])
        if not source_audio.is_file() or digest(source_audio) != item["noisy_sha256"]:
            raise ValueError("Changed no-reference source: " + sample_id)
        audio_sources = {"unprocessed": source_audio}
        for model in MODELS:
            path = INFERENCE / model / Path(item["source"]).name
            if not path.is_file():
                raise FileNotFoundError(path)
            if sf.info(path).samplerate != 16000 or sf.info(path).frames != 160000:
                raise ValueError("Invalid enhanced audio: " + str(path))
            audio_sources[model] = path
        tracks = {}
        for key, path in audio_sources.items():
            target = P808 / "audio" / AUDIO_VERSION / sample_id / (key + ".mp3")
            encode(path, target)
            tracks[key] = {"file": target.relative_to(P808).as_posix(),
                           "sha256": digest(target)}
        selected.append({"dataset": "REAL", "dataset_name": "4floor_2m_deg180_12speech",
                         "dataset_version": "v1.0.1", "sample_id": sample_id,
                         "scene_id": sample_id, "room": "4floor", "array_type": "4ch",
                         "snr_db": item["target_added_noise_snr_db"],
                         "has_reference": False, "source_sha256": item["source_sha256"],
                         "noisy_sha256": item["noisy_sha256"],
                         "noise_sha256": item["noise_sha256"], "tracks": tracks})
        print(sample_id, len(tracks), "tracks", flush=True)
    if len(selected) != 40 or len({trial["sample_id"] for trial in selected}) != 40:
        raise ValueError("Expected 40 unique listening trials")
    weights = allocation.get("sample_weights", {})
    unknown = set(weights) - {trial["sample_id"] for trial in selected}
    if unknown:
        raise ValueError("Unknown allocation sample IDs: " + repr(sorted(unknown)))
    default_weight = float(allocation["default_weight"])
    if not math.isfinite(default_weight) or default_weight <= 0:
        raise ValueError("Invalid default allocation weight")
    for trial in selected:
        weight = float(weights.get(trial["sample_id"], default_weight))
        if not math.isfinite(weight) or weight <= 0:
            raise ValueError("Invalid allocation weight for " + trial["sample_id"])
        trial["allocation_weight"] = weight
    blocks = [[] for _ in range(4)]
    limits = {"ACE": (4, 4, 3, 3), "AIR": (3, 3, 4, 4),
              "REAL": (3, 3, 3, 3)}
    for dataset, counts in limits.items():
        candidates = sorted((trial for trial in selected if trial["dataset"] == dataset),
                            key=lambda trial: hashlib.sha256(
                                ("short40-block-v1:" + trial["sample_id"]).encode()).hexdigest())
        offset = 0
        for block, count in zip(blocks, counts):
            block.extend(trial["sample_id"] for trial in candidates[offset:offset + count])
            offset += count
        if offset != len(candidates):
            raise ValueError("Block allocation does not cover " + dataset)
    if any(len(block) != 10 for block in blocks):
        raise ValueError("Every allocation block must contain 10 samples")
    manifest = {"study": selection["study"], "dataset_version": "v1.0.1",
                "allocation_version": allocation["allocation_version"],
                "allocation_blocks": blocks,
                "audio_version": {"ACE": source["audio_version"],
                                  "AIR": source["audio_version"], "REAL": AUDIO_VERSION},
                "models": source["models"], "trials": selected}
    temporary = OUTPUT.with_name(OUTPUT.name + "." + uuid.uuid4().hex + ".tmp")
    temporary.write_text(json.dumps(manifest, ensure_ascii=False,
                                    separators=(",", ":")) + "\n")
    os.replace(temporary, OUTPUT)
    print("complete", OUTPUT, len(selected), flush=True)


if __name__ == "__main__":
    main()

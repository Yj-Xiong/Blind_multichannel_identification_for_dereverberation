#!/usr/bin/env python3
"""Build ACE full and AIR 30 dB v1.0.1 listening trials."""

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import soundfile as sf


DATASETS = {
    "ACE": "ACE-Chromebook-DeReverb-Test",
    "AIR": "AIR-DeReverb-Test",
}
MODELS = (
    ("cleanmel-offline-l-map", "CleanMel-offline-L-map"),
    ("vinp-ospatialnet", "VINP-oSpatialNet"),
    ("vinp-tcnsas", "VINP-TCN+SA+S"),
    ("dytswig-mamba-ccfaatc", "DyTSwiG-Mamba-CCFAATC"),
    ("unipase", "UniPASE"),
    ("buddy-official", "BUDDy"),
    ("mc-buddy", "MC-BUDDy"),
    ("usddps", "USDDPS"),
)
def load_jsonl(path):
    return {row["sample_id"]: row for row in (json.loads(line) for line in path.read_text().splitlines())}


def selected_metadata(root, dataset):
    pattern = "*_snr*dB.json" if dataset == "ACE" else "*_snr30dB.json"
    rows = [json.loads(path.read_text()) for path in sorted((root / "metadata").glob(pattern))]
    expected = 56 if dataset == "ACE" else 107
    if len(rows) != expected or len({row["sample_id"] for row in rows}) != expected:
        raise ValueError(f"{dataset}: expected {expected} distinct samples, found {len(rows)}")
    if dataset == "AIR" and (len({row["rir_id"] for row in rows}) != 107 or any(row["snr_db"] != 30 for row in rows)):
        raise ValueError("AIR requires one 30 dB sample from each of 107 scenes")
    return sorted(rows, key=lambda row: row["sample_id"])


def encode(source, target, ffmpeg, lowpass=False):
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file() and target.stat().st_size > 0:
        return
    command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", str(source)]
    filters = "pan=mono|c0=c0"
    if lowpass:
        filters += ",lowpass=f=3500"
    command += ["-af", filters, "-ar", "16000", "-codec:a", "libmp3lame", "-b:a", "64k", str(target)]
    subprocess.run(command, check=True)


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ace-root", type=Path, required=True)
    parser.add_argument("--air-root", type=Path, required=True)
    parser.add_argument("--results-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    args = parser.parse_args()
    roots = {"ACE": args.ace_root, "AIR": args.air_root}
    samples = {
        (dataset, model): load_jsonl(args.results_root / model / DATASETS[dataset] / "samples.jsonl")
        for dataset in DATASETS for model, _ in MODELS
    }
    output = args.output
    output.mkdir(parents=True, exist_ok=True)
    manifest = {"study": "ace56-air30-joint-v2", "dataset_version": "v1.0.1", "models": [
        {"id": model, "name": label} for model, label in MODELS
    ], "trials": []}
    for dataset, root in roots.items():
        for meta in selected_metadata(root, dataset):
            sample_id = meta["sample_id"]
            ref_path = Path(meta["clean_dry"])
            input_path = root / "openbench_upload" / "se_in" / f"{sample_id}.wav"
            if sf.info(ref_path).samplerate != 16000 or sf.info(input_path).samplerate != 16000:
                raise ValueError(f"Expected 16 kHz: {sample_id}")
            base = output / "audio" / dataset.lower() / sample_id
            tracks = {
                "reference": (ref_path, False),
                "hidden_reference": (ref_path, False),
                "unprocessed": (input_path, False),
                "lowpass_anchor": (ref_path, True),
            }
            for model, _ in MODELS:
                row = samples[(dataset, model)][sample_id]
                if not Path(row["enhanced_audio"]).is_file():
                    raise FileNotFoundError(f"Missing output: {dataset} {sample_id} {model}")
                tracks[model] = (Path(row["enhanced_audio"]), False)
            trial_tracks = {}
            for key, (source, lowpass) in tracks.items():
                target = base / f"{key}.mp3"
                encode(source, target, args.ffmpeg, lowpass)
                trial_tracks[key] = {"file": target.relative_to(output).as_posix(), "sha256": sha256(target)}
            manifest["trials"].append({
                "dataset": dataset,
                "dataset_name": DATASETS[dataset],
                "dataset_version": "v1.0.1",
                "sample_id": sample_id,
                "scene_id": meta["rir_id"],
                "room": meta["room"],
                "array_type": meta["array_type"],
                "snr_db": meta["snr_db"],
                "tracks": trial_tracks,
            })
            print(f"{dataset} {sample_id}: {len(trial_tracks)} tracks", flush=True)
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"Done: {len(manifest['trials'])} trials", flush=True)


if __name__ == "__main__":
    main()

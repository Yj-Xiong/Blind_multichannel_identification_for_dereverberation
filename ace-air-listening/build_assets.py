#!/usr/bin/env python3
"""Build ACE full and AIR 30 dB v1.0.1 listening trials."""

import argparse
import hashlib
import json
import math
import os
import shutil
import subprocess
import uuid
from pathlib import Path

import numpy as np
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
AIR_AUDIO_VERSION = "air-rms27-peak1p5-v1"
ALL_AUDIO_VERSION = "all-rms27-peak1p5-v1"
TARGET_RMS_DBFS = -27.0
MAX_PEAK_DBFS = -1.5


def load_jsonl(path):
    return {row["sample_id"]: row for row in (json.loads(line) for line in path.read_text().splitlines())}


def selected_metadata(root, dataset, air_snr=30):
    pattern = "*_snr*dB.json" if dataset == "ACE" else f"*_snr{air_snr}dB.json"
    rows = [json.loads(path.read_text()) for path in sorted((root / "metadata").glob(pattern))]
    expected = 56 if dataset == "ACE" else 107
    if len(rows) != expected or len({row["sample_id"] for row in rows}) != expected:
        raise ValueError(f"{dataset}: expected {expected} distinct samples, found {len(rows)}")
    if dataset == "AIR" and (len({row["rir_id"] for row in rows}) != 107 or any(row["snr_db"] != air_snr for row in rows)):
        raise ValueError(f"AIR requires one {air_snr} dB sample from each of 107 scenes")
    return sorted(rows, key=lambda row: row["sample_id"])


def encode(source, target, ffmpeg, gain=1.0):
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file() and target.stat().st_size > 0:
        return
    temporary = target.with_name(f"{target.stem}.{uuid.uuid4().hex}{target.suffix}")
    command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", str(source)]
    filters = f"pan=mono|c0=c0,volume={gain:.12g}"
    command += ["-af", filters, "-ar", "16000", "-codec:a", "libmp3lame", "-b:a", "64k", str(temporary)]
    try:
        subprocess.run(command, check=True)
        os.replace(temporary, target)
    finally:
        if temporary.exists():
            temporary.unlink()


def air_gain(source):
    audio, sample_rate = sf.read(source, dtype="float32", always_2d=True)
    if sample_rate != 16000:
        raise ValueError(f"Expected 16 kHz: {source}")
    mono = audio[:, 0].astype(np.float64)
    if not mono.size or not np.isfinite(mono).all():
        raise ValueError(f"Invalid audio samples: {source}")
    rms = float(np.sqrt(np.mean(mono * mono)))
    peak = float(np.max(np.abs(mono)))
    if rms < 1e-7 or peak < 1e-7:
        return 1.0, {"source_rms_dbfs": None, "applied_gain_db": 0.0,
                     "result_rms_dbfs": None, "peak_limited": False}
    requested_gain = 10 ** (TARGET_RMS_DBFS / 20) / rms
    peak_gain = 10 ** (MAX_PEAK_DBFS / 20) / peak
    gain = min(requested_gain, peak_gain)
    return gain, {
        "source_rms_dbfs": round(20 * math.log10(rms), 3),
        "applied_gain_db": round(20 * math.log10(gain), 3),
        "result_rms_dbfs": round(20 * math.log10(rms * gain), 3),
        "peak_limited": gain < requested_gain,
    }


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
    parser.add_argument("--air-only-level-match", action="store_true",
                        help="Keep ACE audio and scores; publish level-matched AIR files at a new path.")
    parser.add_argument("--all-level-match", action="store_true",
                        help="Publish level-matched ACE and AIR files in a new manifest.")
    parser.add_argument("--manifest-name", default="manifest.json",
                        help="Manifest filename to write under the output directory.")
    parser.add_argument("--air-snr", type=int, choices=(10, 20, 30, 40), default=30,
                        help="AIR SNR used for the independent listening export.")
    args = parser.parse_args()
    if args.air_only_level_match and args.all_level_match:
        parser.error("choose one level matching mode")
    roots = {"ACE": args.ace_root, "AIR": args.air_root}
    level_match_all = args.all_level_match
    samples = {
        (dataset, model): load_jsonl(args.results_root / model / DATASETS[dataset] / "samples.jsonl")
        for dataset in DATASETS if level_match_all or not args.air_only_level_match or dataset == "AIR"
        for model, _ in MODELS
    }
    output = args.output
    output.mkdir(parents=True, exist_ok=True)
    if args.air_only_level_match:
        manifest = json.loads((output / "manifest.json").read_text())
        assert len(manifest["trials"]) == 163
        old_ace = [trial for trial in manifest["trials"] if trial["dataset"] == "ACE"]
        assert len(old_ace) == 56
        manifest["audio_version"] = {"ACE": "original-v1", "AIR": AIR_AUDIO_VERSION}
        manifest["trials"] = old_ace
    elif level_match_all:
        manifest = {"study": "dereverb-p808-batch-v1", "dataset_version": "v1.0.1",
                    "audio_version": ALL_AUDIO_VERSION,
                    "models": [{"id": model, "name": label} for model, label in MODELS],
                    "trials": []}
    else:
        manifest = {"study": "ace56-air30-joint-v3", "dataset_version": "v1.0.1", "models": [
            {"id": model, "name": label} for model, label in MODELS
        ], "trials": []}
    level_report = {"audio_version": ALL_AUDIO_VERSION if level_match_all else AIR_AUDIO_VERSION,
                    "target_rms_dbfs": TARGET_RMS_DBFS,
                    "maximum_peak_dbfs": MAX_PEAK_DBFS, "tracks": []}
    for dataset, root in roots.items():
        if args.air_only_level_match and dataset != "AIR":
            continue
        for meta in selected_metadata(root, dataset, args.air_snr):
            sample_id = meta["sample_id"]
            ref_path = Path(meta["clean_dry"])
            input_path = root / "openbench_upload" / "se_in" / f"{sample_id}.wav"
            if sf.info(ref_path).samplerate != 16000 or sf.info(input_path).samplerate != 16000:
                raise ValueError(f"Expected 16 kHz: {sample_id}")
            folder = (ALL_AUDIO_VERSION if level_match_all
                      else AIR_AUDIO_VERSION if args.air_only_level_match
                      else dataset.lower())
            base = output / "audio" / folder / sample_id
            tracks = {
                "reference": ref_path,
                "hidden_reference": ref_path,
                "unprocessed": input_path,
            }
            for model, _ in MODELS:
                row = samples[(dataset, model)][sample_id]
                if not Path(row["enhanced_audio"]).is_file():
                    raise FileNotFoundError(f"Missing output: {dataset} {sample_id} {model}")
                tracks[model] = Path(row["enhanced_audio"])
            trial_tracks = {}
            for key, source in tracks.items():
                target = base / f"{key}.mp3"
                if args.air_only_level_match or level_match_all:
                    gain, stats = air_gain(source)
                    if key == "hidden_reference":
                        target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copyfile(base / "reference.mp3", target)
                    else:
                        encode(source, target, args.ffmpeg, gain)
                    level_report["tracks"].append({"sample_id": sample_id, "track": key, **stats})
                else:
                    encode(source, target, args.ffmpeg)
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
    if args.air_only_level_match:
        assert len(manifest["trials"]) == 163
        assert len(level_report["tracks"]) == 107 * 11
        report_path = output / "air_loudness_report.json"
        report_path.write_text(json.dumps(level_report, indent=2, ensure_ascii=False) + "\n")
    if level_match_all:
        assert len(manifest["trials"]) == 163
        assert len(level_report["tracks"]) == 163 * 11
        (output / "all_loudness_report.json").write_text(
            json.dumps(level_report, indent=2, ensure_ascii=False) + "\n")
    temporary = output / f"{args.manifest_name}.{uuid.uuid4().hex}.tmp"
    temporary.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    os.replace(temporary, output / args.manifest_name)
    print(f"Done: {len(manifest['trials'])} trials", flush=True)


if __name__ == "__main__":
    main()

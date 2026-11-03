#!/usr/bin/env python3
"""Check that the eight-second listening audio and objective CSV are paired."""

from __future__ import annotations

import csv
import hashlib
import json
import math
import os
import re
import subprocess
import uuid
import zipfile
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent
P808 = ROOT / "p808"
WINDOWS = P808 / "real8s_crop_windows.json"
PAGE_MANIFEST = P808 / "real12_8s_manifest.json"
PAGE = P808 / "real-recording.html"
OBJECTIVE = ROOT.parent / "subjective_se_pages/p808/real_objective_8s_v1"
REPORT = P808 / "real8s_validation.json"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def decode(path: Path) -> np.ndarray:
    result = subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-i", str(path),
        "-f", "f32le", "-acodec", "pcm_f32le", "-ar", "16000", "-ac", "1", "pipe:1",
    ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    audio = np.frombuffer(result.stdout, dtype="<f4")
    if audio.size != 128000 or not np.isfinite(audio).all():
        raise ValueError(f"MP3 did not decode to exactly eight seconds: {path}: {audio.size}")
    return audio


def main() -> None:
    windows = json.loads(WINDOWS.read_text())
    public = json.loads(PAGE_MANIFEST.read_text())
    page = PAGE.read_text()
    match = re.search(r"<script>window\.P808_DATA=(.*?);window\.P808_STAGING_ENDPOINT=", page, re.S)
    if not match or json.loads(match.group(1)) != public:
        raise ValueError("Embedded page manifest mismatch")
    if public["study"] != "dereverbReal12v2" or public["duration_seconds"] != 8:
        raise ValueError("Wrong published study identity")
    if len(windows["samples"]) != 12 or len(public["trials"]) != 12:
        raise ValueError("Expected 12 trials")
    if not (P808 / "real-listening-10s-archive.html").is_file():
        raise ValueError("Old 10-second page not archived")
    if 'url=real-recording.html' not in (P808 / "real-listening.html").read_text():
        raise ValueError("Old URL does not redirect")

    correlations = []
    count = 0
    for crop, trial in zip(windows["samples"], public["trials"]):
        sample_id = crop["sample_id"]
        if trial["sample_id"] != sample_id:
            raise ValueError("Trial/crop order mismatch")
        if crop["end_sample"] - crop["start_sample"] != 128000:
            raise ValueError("Non-eight-second crop")
        if len(crop["tracks"]) != 11 or len(trial["tracks"]) != 11:
            raise ValueError("Missing audio tracks")
        if crop["tracks"]["reference"]["listening_sha256"] != crop["tracks"]["hidden_reference"]["listening_sha256"]:
            raise ValueError("Reference and hidden reference are not identical")
        for key, track in crop["tracks"].items():
            mp3 = P808 / track["listening_mp3"]
            if not mp3.is_file() or sha256(mp3) != track["listening_sha256"]:
                raise ValueError(f"Missing or changed MP3: {mp3}")
            if trial["tracks"][key]["sha256"] != track["listening_sha256"]:
                raise ValueError("Published hash differs from crop manifest")
            if key == "hidden_reference":
                continue
            wav = ROOT.parent / track["lossless_wav"]
            if not wav.is_file() or sha256(wav) != track["lossless_sha256"]:
                raise ValueError(f"Missing or changed lossless WAV: {wav}")
            audio, rate = sf.read(wav, dtype="float32")
            if rate != 16000 or audio.shape != (128000,) or not np.isfinite(audio).all():
                raise ValueError(f"Invalid lossless WAV: {wav}")
            if float(np.max(np.abs(audio))) > 10 ** (-1.5 / 20) + 1e-5:
                raise ValueError(f"Peak ceiling exceeded: {wav}")
            decoded = decode(mp3)
            corr = float(np.corrcoef(audio.astype(np.float64), decoded.astype(np.float64))[0, 1])
            if not math.isfinite(corr) or corr < .95:
                raise ValueError(f"MP3 does not match lossless WAV: {mp3}: {corr}")
            correlations.append(corr)
            count += 1
        print(sample_id, "validated", flush=True)

    with (OBJECTIVE / "real12_per_sample_objective.csv").open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    metrics = [key for key in rows[0] if key not in (
        "dataset", "dataset_version", "sample_id", "track", "target_added_noise_snr_db",
        "enhanced_audio", "enhanced_sha256", "reference_audio", "reference_sha256")]
    if len(rows) != 120 or len(metrics) != 20 or len({(r["sample_id"], r["track"]) for r in rows}) != 120:
        raise ValueError("Objective CSV coverage mismatch")
    crops_by_id = {item["sample_id"]: item for item in windows["samples"]}
    for row in rows:
        crop = crops_by_id[row["sample_id"]]
        if row["enhanced_sha256"] != crop["tracks"][row["track"]]["lossless_sha256"]:
            raise ValueError("Objective score used a different enhanced WAV")
        if row["reference_sha256"] != crop["tracks"]["reference"]["lossless_sha256"]:
            raise ValueError("Objective score used a different reference WAV")
        for key in metrics:
            if row["track"] == "reference" and key == "si_sdr":
                if row[key] != "":
                    raise ValueError("Reference SI-SDR should be blank")
            elif not math.isfinite(float(row[key])):
                raise ValueError("Nonfinite objective score")
    package = OBJECTIVE / "real8s_objective_results.zip"
    with zipfile.ZipFile(package) as archive:
        if archive.testzip() is not None or "crop_manifest.json" not in archive.namelist():
            raise ValueError("Objective ZIP failed CRC or lacks crop manifest")
    result = {
        "schema": "se.subjective.real8s_validation.v1",
        "study": "dereverbReal12v2", "samples": 12,
        "scored_candidates_per_sample": 10, "public_references_per_sample": 1,
        "mp3_files": 132, "decoded_mp3_files": count,
        "decoded_frames_per_file": 128000,
        "minimum_mp3_lossless_correlation": min(correlations),
        "objective_rows": len(rows), "objective_metrics": len(metrics),
        "objective_zip_crc": "passed", "status": "passed",
    }
    temp = REPORT.with_name(REPORT.name + "." + uuid.uuid4().hex + ".tmp")
    temp.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    os.replace(temp, REPORT)
    print("complete validation", REPORT, result, flush=True)


if __name__ == "__main__":
    main()

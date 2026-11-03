#!/usr/bin/env python3
"""Create an ITU-R BS.1770 loudness-normalized 8-second real-recording set.

The crop windows are inherited from real8s_crop_windows.json. Each mono track
is measured with FFmpeg's BS.1770/EBU R128 loudnorm filter in two-pass mode,
targeting -23 LUFS and -1 dBTP maximum true peak.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parent
P808 = ROOT / "p808"
WINDOWS = P808 / "real8s_crop_windows.json"
LOSSLESS = WORKSPACE / "subjective_se_pages/p808/real8s_lufs_lossless_v1"
PUBLIC = P808 / "audio/real8s-lufs23-tp1-v1"
MANIFEST = P808 / "real8s_lufs_crop_manifest.json"
RATE = 16000
FRAMES = 128000
TARGET_I = -23.0
TARGET_TP = -1.0
TARGET_LRA = 7.0
MODELS = (
    "cleanmel-offline-l-map", "vinp-ospatialnet", "vinp-tcnsas",
    "dytswig-mamba-ccfaatc", "unipase", "buddy-official", "mc-buddy", "usddps",
)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def run_loudnorm(input_path: Path, output_path: Path) -> dict:
    def scan(path: Path) -> dict:
        command = ["ffmpeg", "-hide_banner", "-nostdin", "-y", "-i", str(input_path),
                   "-af", f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}:print_format=json",
                   "-f", "null", "-"]
        result = subprocess.run(command, text=True, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, check=True)
        blocks = re.findall(r"\{\s*\"input_i\".*?\}", result.stderr, re.S)
        if not blocks:
            raise RuntimeError(f"BS.1770 first pass did not return JSON: {input_path}")
        return json.loads(blocks[-1])

    # The scanner uses the same BS.1770 K-weighted gated measurement for both
    # passes. The path in the command must be the file being scanned.
    def scan(path: Path) -> dict:
        command = ["ffmpeg", "-hide_banner", "-nostdin", "-y", "-i", str(path),
                   "-af", f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}:print_format=json",
                   "-f", "null", "-"]
        result = subprocess.run(command, text=True, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, check=True)
        blocks = re.findall(r"\{\s*\"input_i\".*?\}", result.stderr, re.S)
        if not blocks:
            raise RuntimeError(f"BS.1770 scan did not return JSON: {path}")
        return json.loads(blocks[-1])

    measured = scan(input_path)
    params = ":".join([
        f"I={TARGET_I}", f"TP={TARGET_TP}", f"LRA={TARGET_LRA}",
        f"measured_I={measured['input_i']}", f"measured_TP={measured['input_tp']}",
        f"measured_LRA={measured['input_lra']}",
        f"measured_thresh={measured['input_thresh']}",
        f"offset={measured['target_offset']}", "linear=true", "print_format=json",
    ])
    command = ["ffmpeg", "-hide_banner", "-nostdin", "-y", "-i", str(input_path),
               "-af", f"loudnorm={params}", "-ar", str(RATE), "-ac", "1",
               "-c:a", "pcm_f32le", str(output_path)]
    result = subprocess.run(command, text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, check=True)
    blocks = re.findall(r"\{\s*\"input_i\".*?\}", result.stderr, re.S)
    second = json.loads(blocks[-1]) if blocks else {}
    # FFmpeg may choose dynamic mode for short speech and leave a residual
    # offset. Correct that residual only while the measured true peak has room.
    correction_scan = scan(output_path)
    residual_db = TARGET_I - float(correction_scan["input_i"])
    tp_room_db = TARGET_TP - float(correction_scan["input_tp"])
    correction_db = min(residual_db, tp_room_db)
    if abs(correction_db) > 0.05:
        corrected = output_path.with_name(output_path.stem + ".corrected." + uuid.uuid4().hex + ".wav")
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                        "-i", str(output_path), "-af", f"volume={correction_db:.12g}dB",
                        "-ar", str(RATE), "-ac", "1", "-c:a", "pcm_f32le", str(corrected)], check=True)
        os.replace(corrected, output_path)
    final = scan(output_path)
    return {"target_i_lufs": TARGET_I, "target_tp_db": TARGET_TP,
            "target_lra_lu": TARGET_LRA, "first_pass": measured,
            "second_pass": second, "final_scan": final,
            "residual_correction_db": correction_db,
            "true_peak_limited": residual_db > tp_room_db + 1e-6}


def main() -> None:
    source = json.loads(WINDOWS.read_text())
    if source["frames_per_clip"] != FRAMES or source["duration_seconds"] != 8:
        raise ValueError("Expected the existing 8-second crop windows")
    records = []
    for item in source["samples"]:
        sample_id = item["sample_id"]
        start, end = int(item["start_sample"]), int(item["end_sample"])
        tracks = {}
        for key, info in item["tracks"].items():
            if key == "hidden_reference":
                continue
            original = WORKSPACE / info["source_wav"]
            audio, rate = sf.read(original, dtype="float32", always_2d=True)
            if rate != RATE or audio.shape[0] < end or not np.isfinite(audio).all():
                raise ValueError(f"Invalid source for {sample_id} {key}: {original}")
            clip = np.ascontiguousarray(audio[start:end, 0])
            if clip.shape != (FRAMES,):
                raise ValueError(f"Invalid crop for {sample_id} {key}")
            with tempfile.TemporaryDirectory(prefix="bs1770-crop-") as temporary:
                raw = Path(temporary) / "crop.wav"
                sf.write(raw, clip, RATE, subtype="FLOAT")
                output = LOSSLESS / sample_id / f"{key}.wav"
                output.parent.mkdir(parents=True, exist_ok=True)
                stats = run_loudnorm(raw, output)
            measured = stats.get("second_pass", {})
            track = {"source_wav": info["source_wav"],
                     "source_sha256": info["source_sha256"],
                     "lossless_wav": str(output.relative_to(WORKSPACE)),
                     "lossless_sha256": sha256(output),
                     "normalization": "ITU-R BS.1770 gated loudnorm two-pass",
                     **stats}
            tracks[key] = track
            print(sample_id, key, "input", stats["first_pass"].get("input_i"),
                  "output", measured.get("output_i"), "TP", measured.get("output_tp"), flush=True)
        reference = tracks["reference"]
        hidden = PUBLIC / sample_id / "hidden_reference.mp3"
        public_wav = Path(reference["lossless_wav"]) if Path(reference["lossless_wav"]).is_absolute() else WORKSPACE / reference["lossless_wav"]
        public = PUBLIC / sample_id / "reference.mp3"
        public.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                        "-i", str(public_wav), "-codec:a", "libmp3lame", "-b:a", "64k",
                        "-ar", str(RATE), "-ac", "1", str(public)], check=True)
        shutil.copyfile(public, hidden)
        for key, track in tracks.items():
            mp3 = PUBLIC / sample_id / f"{key}.mp3"
            if key == "reference":
                mp3 = public
            else:
                wav = WORKSPACE / track["lossless_wav"]
                subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                                "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "64k",
                                "-ar", str(RATE), "-ac", "1", str(mp3)], check=True)
            track["listening_mp3"] = str(mp3.relative_to(P808))
            track["listening_sha256"] = sha256(mp3)
        tracks["hidden_reference"] = {"listening_mp3": str(hidden.relative_to(P808)),
                                       "listening_sha256": sha256(hidden),
                                       "identical_to": "reference"}
        if tracks["reference"]["listening_sha256"] != tracks["hidden_reference"]["listening_sha256"]:
            raise ValueError("Reference and hidden reference differ")
        records.append({"sample_id": sample_id, "start_sample": start,
                        "end_sample": end, "start_seconds": start / RATE,
                        "end_seconds": end / RATE, "tracks": tracks})
    manifest = {"schema": "se.subjective.real8s_lufs_crop.v1", "dataset_version": "v1.0.1",
                "audio_version": "real8s-lufs23-tp1-v1", "study": "dereverbReal12v3",
                "sample_rate": RATE, "frames_per_clip": FRAMES, "duration_seconds": 8,
                "target_integrated_loudness_lufs": TARGET_I,
                "maximum_true_peak_dbtp": TARGET_TP,
                "loudness_standard": "ITU-R BS.1770 gated K-weighted loudness; FFmpeg loudnorm two-pass",
                "lra_parameter_lu": TARGET_LRA, "samples": records}
    temp = MANIFEST.with_name(MANIFEST.name + "." + uuid.uuid4().hex + ".tmp")
    temp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    os.replace(temp, MANIFEST)
    print("complete", MANIFEST, len(records), flush=True)


if __name__ == "__main__":
    main()

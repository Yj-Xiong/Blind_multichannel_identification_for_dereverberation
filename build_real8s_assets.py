#!/usr/bin/env python3
"""Cut the 12 real-recording listening trials to paired eight-second windows."""

from __future__ import annotations

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
WORKSPACE = ROOT.parent
P808 = ROOT / "p808"
INFER = WORKSPACE / "subjective_se_pages/p808/real_inference"
NOISY = WORKSPACE / "subjective_se_pages/p808/real_noisy_5to20db_v1"
REFERENCES = WORKSPACE / "4floor_2m_deg180_12speech/aligned_references"
LOSSLESS = WORKSPACE / "subjective_se_pages/p808/real8s_lossless_v1"
PUBLIC = P808 / "audio/real8s-rms27-peak1p5-v1"
MANIFEST = P808 / "real8s_crop_windows.json"
MODELS = (
    "cleanmel-offline-l-map", "vinp-ospatialnet", "vinp-tcnsas",
    "dytswig-mamba-ccfaatc", "unipase", "buddy-official", "mc-buddy", "usddps",
)
RATE = 16000
WINDOW = RATE * 8
FADE = 80  # 5 ms at both ends avoids a click at a crop boundary.


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_mono(path: Path) -> np.ndarray:
    audio, rate = sf.read(path, dtype="float32", always_2d=True)
    if rate != RATE or audio.shape[0] != RATE * 10 or not np.isfinite(audio).all():
        raise ValueError(f"Expected finite 16-kHz 10-s WAV: {path}")
    if path.parent == NOISY and audio.shape[1] != 4:
        raise ValueError(f"Expected four microphone channels: {path}")
    if path.parent != NOISY and audio.shape[1] != 1:
        raise ValueError(f"Expected mono WAV: {path}")
    return np.ascontiguousarray(audio[:, 0])


def choose_start(reference: np.ndarray) -> tuple[int, float, float]:
    """Find a speech-rich eight-second window with low-energy crop boundaries.

    Search at 10-ms resolution. Candidate windows must retain at least 85% of
    the maximum possible eight-second mean square energy. Among them choose the
    lowest mean 100-ms boundary energy relative to its interior energy.
    The model outputs do not influence this selection.
    """
    energy = reference.astype(np.float64) ** 2
    cumulative = np.r_[0.0, np.cumsum(energy)]
    starts = np.arange(0, RATE * 2 + 1, RATE // 100, dtype=np.int64)
    interior = (cumulative[starts + WINDOW] - cumulative[starts]) / WINDOW
    maximum = float(interior.max())
    if maximum <= 1e-12:
        raise ValueError("Silent reference")
    edge = RATE // 10
    left = (cumulative[starts + edge] - cumulative[starts]) / edge
    right = (cumulative[starts + WINDOW] - cumulative[starts + WINDOW - edge]) / edge
    boundary_ratio = (left + right) / (2 * np.maximum(interior, 1e-12))
    allowed = interior >= 0.85 * maximum
    index = int(np.argmin(np.where(allowed, boundary_ratio, np.inf)))
    return int(starts[index]), float(interior[index] / maximum), float(boundary_ratio[index])


def crop_normalize(audio: np.ndarray, start: int) -> tuple[np.ndarray, float]:
    clip = audio[start:start + WINDOW].astype(np.float64, copy=True)
    if clip.size != WINDOW:
        raise ValueError("Invalid eight-second crop")
    ramp = np.linspace(0.0, 1.0, FADE, endpoint=True)
    clip[:FADE] *= ramp
    clip[-FADE:] *= ramp[::-1]
    rms = math.sqrt(float(np.mean(clip ** 2)))
    peak = float(np.max(np.abs(clip)))
    if rms <= 1e-8 or peak <= 1e-8:
        raise ValueError("Silent eight-second crop")
    gain = min(10 ** (-27.0 / 20.0) / rms, 10 ** (-1.5 / 20.0) / peak)
    return (clip * gain).astype(np.float32), float(gain)


def save_wav(path: Path, audio: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.stem + "." + uuid.uuid4().hex + ".wav")
    try:
        sf.write(temp, audio, RATE, subtype="FLOAT")
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def save_mp3(wav: Path, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.stem + "." + uuid.uuid4().hex + ".mp3")
    try:
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin",
                        "-y", "-i", str(wav), "-ar", "16000", "-codec:a", "libmp3lame",
                        "-b:a", "64k", str(temp)], check=True)
        if temp.stat().st_size <= 0:
            raise ValueError(f"Empty MP3: {path}")
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def main() -> None:
    input_manifest = json.loads((NOISY / "manifest.json").read_text())
    if len(input_manifest["samples"]) != 12:
        raise ValueError("Expected exactly 12 real recordings")
    records = []
    for number, source in enumerate(input_manifest["samples"], 1):
        sample_id = f"real_4floor_{number:02d}"
        if source["sample_id"] != sample_id:
            raise ValueError(f"Input manifest order mismatch: {sample_id}")
        reference_path = REFERENCES / f"reference_for_2m_deg180_{number}.wav"
        paths = {"reference": reference_path,
                 "unprocessed": NOISY / f"2m_deg180_{number}.wav"}
        paths.update({model: INFER / model / f"2m_deg180_{number}.wav" for model in MODELS})
        loaded = {key: load_mono(path) for key, path in paths.items()}
        start, retained_energy, edge_ratio = choose_start(loaded["reference"])
        record = {"sample_id": sample_id, "start_sample": start,
                  "end_sample": start + WINDOW, "start_seconds": start / RATE,
                  "end_seconds": (start + WINDOW) / RATE,
                  "retained_energy_fraction_of_best_8s": retained_energy,
                  "boundary_energy_ratio": edge_ratio, "tracks": {}}
        for key, source_audio in loaded.items():
            clip, gain = crop_normalize(source_audio, start)
            wav = LOSSLESS / sample_id / f"{key}.wav"
            mp3 = PUBLIC / sample_id / f"{key}.mp3"
            save_wav(wav, clip)
            save_mp3(wav, mp3)
            record["tracks"][key] = {
                "source_wav": str(paths[key].relative_to(WORKSPACE)),
                "source_sha256": sha256(paths[key]),
                "lossless_wav": str(wav.relative_to(WORKSPACE)),
                "lossless_sha256": sha256(wav),
                "listening_mp3": str(mp3.relative_to(P808)), "listening_sha256": sha256(mp3),
                "applied_gain_db": 20 * math.log10(gain),
            }
        public = PUBLIC / sample_id / "reference.mp3"
        hidden = PUBLIC / sample_id / "hidden_reference.mp3"
        with tempfile.NamedTemporaryFile(dir=hidden.parent, suffix=".mp3", delete=False) as stream:
            temporary = Path(stream.name)
        try:
            temporary.write_bytes(public.read_bytes())
            os.replace(temporary, hidden)
        finally:
            temporary.unlink(missing_ok=True)
        record["tracks"]["hidden_reference"] = {
            "listening_mp3": str(hidden.relative_to(P808)), "listening_sha256": sha256(hidden),
            "identical_to": "reference",
        }
        if sha256(public) != sha256(hidden):
            raise ValueError("Hidden reference differs from public reference")
        records.append(record)
        print(sample_id, f"{start / RATE:.2f}-{(start + WINDOW) / RATE:.2f}s",
              len(record["tracks"]), "tracks", flush=True)
    manifest = {"schema": "se.subjective.real8s_crop.v1", "dataset_version": "v1.0.1",
                "audio_version": "real8s-rms27-peak1p5-v1", "sample_rate": RATE,
                "frames_per_clip": WINDOW, "duration_seconds": 8,
                "window_rule": "10-ms search; >=85% of maximum 8-s reference energy; minimize mean 100-ms edge energy / interior energy",
                "normalization": "per-crop -27 dBFS RMS target, -1.5 dBFS peak ceiling; 5-ms fades",
                "samples": records}
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    temp = MANIFEST.with_name(MANIFEST.name + "." + uuid.uuid4().hex + ".tmp")
    temp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    os.replace(temp, MANIFEST)
    print("complete", MANIFEST, len(records), "samples", flush=True)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Mix one documented REVERB ambient recording into 12 four-channel clips."""

import hashlib
import json
import math
import os
import uuid
from pathlib import Path

import numpy as np
import soundfile as sf


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / "4floor_2m_deg180_12speech"
NOISE = Path("/hpc_stor01/home/yujie.xiong_sx/data/REVERB-Challenge/"
             "reverb_tools_for_Generate_SimData/NOISE/Noise_SimRoom1_1.wav")
OUTPUT = ROOT / "p808" / "real_noisy_5to20db_v1"
EXPECTED_NOISE_SHA256 = "479bf72af27005b791ad8cf2b0b40c94573bd3a18cc63ca8d69a04ebf4aa75fb"


def digest(path):
    hasher = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            hasher.update(block)
    return hasher.hexdigest()


def main():
    noise_hash = digest(NOISE)
    if noise_hash != EXPECTED_NOISE_SHA256:
        raise ValueError("Ambient noise source changed: " + noise_hash)
    noise, rate = sf.read(NOISE, dtype="float32", always_2d=True)
    if rate != 16000 or noise.shape != (480000, 8):
        raise ValueError("Unexpected ambient noise format: " + str(noise.shape))
    # The first channel provides one common ambient field across all four mics.
    mono_noise = noise[:, 0].astype(np.float64)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = []
    for number in range(1, 13):
        source = SOURCE / f"2m_deg180_{number}.wav"
        signal, source_rate = sf.read(source, dtype="float32", always_2d=True)
        if source_rate != 16000 or signal.shape != (160000, 4):
            raise ValueError("Unexpected source format: " + str(source))
        start = 10000 + (number - 1) * 21000
        segment = mono_noise[start:start + len(signal)]
        if len(segment) != len(signal):
            raise ValueError("Ambient recording is too short")
        segment = segment - segment.mean()
        signal_power = float(np.mean(signal.astype(np.float64) ** 2))
        noise_power = float(np.mean(segment ** 2))
        if signal_power <= 0 or noise_power <= 0:
            raise ValueError("Silent source or ambient segment: " + str(source))
        target_snr = 5.0 + (number - 1) * 15.0 / 11.0
        gain = math.sqrt(signal_power / (noise_power * 10 ** (target_snr / 10)))
        added = gain * segment[:, None]
        mixed = signal.astype(np.float64) + added
        peak = float(np.max(np.abs(mixed)))
        peak_scale = min(1.0, 0.95 / peak)
        output = (mixed * peak_scale).astype(np.float32)
        destination = OUTPUT / source.name
        temporary = destination.with_name(destination.stem + "." + uuid.uuid4().hex + ".wav")
        sf.write(temporary, output, 16000, subtype="FLOAT")
        os.replace(temporary, destination)
        measured_snr = 10 * math.log10(signal_power / float(np.mean(added ** 2)))
        records.append({"sample_id": f"real_4floor_{number:02d}",
                        "source": str(source), "source_sha256": digest(source),
                        "noisy_audio": str(destination), "noisy_sha256": digest(destination),
                        "noise_source": str(NOISE), "noise_sha256": noise_hash,
                        "noise_start_sample": start, "noise_channel": 0,
                        "target_added_noise_snr_db": target_snr,
                        "measured_added_noise_snr_db": measured_snr,
                        "global_peak_scale": peak_scale,
                        "sample_rate": 16000, "channels": 4, "frames": len(signal)})
        print(source.name, "target", round(target_snr, 2), "measured",
              round(measured_snr, 2), flush=True)
    manifest = OUTPUT / "manifest.json"
    temporary = manifest.with_name(manifest.name + "." + uuid.uuid4().hex + ".tmp")
    temporary.write_text(json.dumps({"schema": "se.subjective.real_noisy.v1",
                                     "noise_source_sha256": noise_hash,
                                     "samples": records}, indent=2) + "\n")
    os.replace(temporary, manifest)
    print("complete", manifest, flush=True)


if __name__ == "__main__":
    main()

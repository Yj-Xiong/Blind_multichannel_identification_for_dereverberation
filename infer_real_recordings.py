#!/usr/bin/env python3
"""Run the eight existing dereverberation methods on 12 real recordings."""

import argparse
import contextlib
import json
import os
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parent
INPUT = ROOT / "p808" / "real_noisy_5to20db_v1"
OUTPUT = ROOT / "p808" / "real_inference"
MODELS = (
    "cleanmel-offline-l-map", "vinp-ospatialnet", "vinp-tcnsas",
    "dytswig-mamba-ccfaatc", "unipase", "buddy-official",
    "mc-buddy", "usddps",
)


def sources():
    import soundfile as sf

    files = [INPUT / f"2m_deg180_{index}.wav" for index in range(1, 13)]
    for file in files:
        if not file.is_file():
            raise FileNotFoundError(file)
        info = sf.info(file)
        if info.samplerate != 16000 or info.channels != 4 or info.frames != 160000:
            raise ValueError("Expected 10 seconds of 16 kHz four-channel audio: " + str(file))
    return files


def run_adapter(model_name, files, output_dir):
    import soundfile as sf

    model_dir = WORKSPACE / "openbench_upload_ready" / model_name
    if not (model_dir / "model.py").is_file():
        raise FileNotFoundError(model_dir / "model.py")
    sys.path.insert(0, str(model_dir))
    os.chdir(model_dir)
    from model import Model

    model = Model(device="cuda")
    for index, source in enumerate(files, 1):
        destination = output_dir / source.name
        if not destination.is_file():
            with tempfile.TemporaryDirectory(prefix="real-infer-", dir=output_dir) as temporary:
                candidate = Path(temporary) / source.name
                result = model.run_tool(str(source), output_path=str(candidate))
                if Path(result.audio_path) != candidate or not candidate.is_file():
                    raise RuntimeError("Unexpected model output for " + str(source))
                validate_audio(candidate)
                os.replace(candidate, destination)
        validate_audio(destination)
        print(model_name, index, "/", len(files), flush=True)


def run_cleanmel(files, output_dir):
    import numpy as np
    import soundfile as sf
    import torch

    sys.path.insert(0, str(WORKSPACE / "CleanMel"))
    from run_cleanmel_openbench import enhance, load_models

    device = torch.device("cuda")
    torch.set_num_threads(4)
    torch.set_grad_enabled(False)
    input_stft, model, vocos = load_models(device)
    for index, source in enumerate(files, 1):
        destination = output_dir / source.name
        if not destination.is_file():
            audio, rate = sf.read(source, dtype="float32", always_2d=True)
            if rate != 16000:
                raise ValueError(source)
            with torch.inference_mode():
                enhanced = enhance(np.ascontiguousarray(audio[:, 0]),
                                   input_stft, model, vocos, device)
            with tempfile.TemporaryDirectory(prefix="real-infer-", dir=output_dir) as temporary:
                candidate = Path(temporary) / source.name
                sf.write(candidate, enhanced, 16000, subtype="FLOAT")
                validate_audio(candidate)
                os.replace(candidate, destination)
        validate_audio(destination)
        print("cleanmel-offline-l-map", index, "/", len(files), flush=True)


def run_unipase(files, output_dir):
    import soundfile as sf

    missing = [file for file in files if not (output_dir / file.name).is_file()]
    if missing:
        with tempfile.TemporaryDirectory(prefix="real-unipase-", dir=OUTPUT) as temporary:
            base = Path(temporary)
            inputs = base / "inputs"
            generated = base / "generated"
            inputs.mkdir()
            generated.mkdir()
            for source in missing:
                audio, rate = sf.read(source, dtype="float32", always_2d=True)
                sf.write(inputs / source.name, audio[:, 0], rate, subtype="FLOAT")
            checkpoints = WORKSPACE / "unipase" / "checkpoints"
            command = [sys.executable, "-m", "inference.inference",
                       "-I", str(inputs), "-O", str(generated), "-D", "cuda:0",
                       "-E", ".wav", "--dewavlm_ckpt", str(checkpoints / "DeWavLM-Omni.pt"),
                       "--adapter_ckpt", str(checkpoints / "Adapter.pt"),
                       "--vocoder_ckpt", str(checkpoints / "Vocoder_DWO-L1.pt"),
                       "--postnet_ckpt", str(checkpoints / "PostNet.pt")]
            env = dict(os.environ, PYTHONNOUSERSITE="1")
            subprocess.run(command, cwd=WORKSPACE / "unipase", env=env, check=True)
            for source in missing:
                produced = generated / source.name
                validate_audio(produced)
                os.replace(produced, output_dir / source.name)
    for index, source in enumerate(files, 1):
        validate_audio(output_dir / source.name)
        print("unipase", index, "/", len(files), flush=True)


def validate_audio(path):
    import numpy as np
    import soundfile as sf

    audio, rate = sf.read(path, dtype="float32", always_2d=True)
    if rate != 16000 or audio.shape[0] != 160000 or not np.isfinite(audio).all():
        raise ValueError("Invalid inference output: " + str(path))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", choices=MODELS, required=True)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    files = sources()
    if args.validate_only:
        print("validated", len(files), "sources")
        return
    output_dir = OUTPUT / args.model
    output_dir.mkdir(parents=True, exist_ok=True)
    if args.model == "cleanmel-offline-l-map":
        run_cleanmel(files, output_dir)
    elif args.model == "unipase":
        run_unipase(files, output_dir)
    else:
        run_adapter(args.model, files, output_dir)
    result = {"model": args.model, "source": str(INPUT),
              "samples": [file.name for file in files], "status": "completed"}
    temporary = output_dir / ("progress." + uuid.uuid4().hex + ".tmp")
    temporary.write_text(json.dumps(result, indent=2) + "\n")
    os.replace(temporary, output_dir / "progress.json")


if __name__ == "__main__":
    main()

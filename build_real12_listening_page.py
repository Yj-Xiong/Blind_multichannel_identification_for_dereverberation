#!/usr/bin/env python3
"""Build a separate 12-trial real-recording listening study."""

import hashlib
import json
import os
import re
import shutil
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from build_short40_manifest import digest, encode


ROOT = Path(__file__).resolve().parent
P808 = ROOT / "p808"
RECORDINGS = ROOT.parent / "4floor_2m_deg180_12speech"
ALIGNMENT = RECORDINGS / "aligned_references"
MODEL_AUDIO = P808 / "audio" / "real-noisy-5to20db-rms27-v1"
REFERENCE_AUDIO = P808 / "audio" / "real-aligned-playback-ref-rms27-v1"
MANIFEST = P808 / "real12_manifest.json"
OUTPUT = P808 / "real-listening.html"
PAGE_TEMPLATE = P808 / "index.html"
MODEL_MANIFEST = P808 / "short28_manifest.json"
TRACKS = ("unprocessed", "cleanmel-offline-l-map", "vinp-ospatialnet",
          "vinp-tcnsas", "dytswig-mamba-ccfaatc", "unipase",
          "buddy-official", "mc-buddy", "usddps")


def replace_once(text, old, new):
    count = text.count(old)
    if count != 1:
        raise ValueError("Expected one HTML template occurrence, got {}: {}".format(
            count, old[:80]))
    return text.replace(old, new)


def check_alignment():
    entries = [json.loads(line) for line in
               (ALIGNMENT / "alignment_manifest.jsonl").read_text().splitlines()
               if line.strip()]
    summary = json.loads((ALIGNMENT / "alignment_summary.json").read_text())
    scores = np.asarray(summary["score_matrix"], dtype=float)
    if len(entries) != 12 or scores.shape != (12, 12):
        raise ValueError("Expected 12 aligned recording/reference pairs")
    if {entry["playback_block"] for entry in entries} != set(range(1, 13)):
        raise ValueError("Playback blocks are not one-to-one")
    for index, entry in enumerate(entries):
        number = index + 1
        source = RECORDINGS / entry["recording"]
        reference = ALIGNMENT / entry["reference"]
        if entry["recording"] != "2m_deg180_{}.wav".format(number):
            raise ValueError("Recording order changed: " + entry["recording"])
        if entry["playback_block"] != number:
            raise ValueError("Reference does not match numbered recording")
        rec_info, ref_info = sf.info(source), sf.info(reference)
        if (rec_info.samplerate != 16000 or ref_info.samplerate != 16000 or
                rec_info.frames != 160000 or ref_info.frames != 160000 or
                rec_info.channels != 4 or ref_info.channels != 1):
            raise ValueError("Unexpected recording/reference audio format")
        if abs(entry["alignment_lag_ms"]) > 2.1:
            raise ValueError("Reference exceeds alignment tolerance")
        best = float(scores[index, number-1])
        other = float(max(scores[index, j] for j in range(12) if j != number-1))
        if best < .20 or best <= 5*other:
            raise ValueError("Weak or ambiguous reference match for recording {}".format(number))
    return entries


def audio_track(path):
    if not path.is_file() or path.stat().st_size <= 0:
        raise FileNotFoundError(path)
    return {"file": str(path.relative_to(P808)), "sha256": digest(path)}


def encode_references(entries):
    for number, entry in enumerate(entries, 1):
        source = ALIGNMENT / entry["reference"]
        sample_id = "real_4floor_{:02d}".format(number)
        target = REFERENCE_AUDIO / sample_id / "reference.mp3"
        encode(source, target)
        hidden = target.with_name("hidden_reference.mp3")
        if not hidden.is_file() or digest(hidden) != digest(target):
            hidden.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=str(hidden.parent),
                                             suffix=".mp3", delete=False) as stream:
                temporary = Path(stream.name)
            try:
                shutil.copyfile(target, temporary)
                os.replace(str(temporary), str(hidden))
            finally:
                if temporary.exists():
                    temporary.unlink()


def build_manifest(entries):
    model_source = json.loads(MODEL_MANIFEST.read_text())
    models = model_source["models"]
    if [model["id"] for model in models] != list(TRACKS[1:]):
        raise ValueError("Model list differs from the paired listening study")
    trials = []
    for number, entry in enumerate(entries, 1):
        sample_id = "real_4floor_{:02d}".format(number)
        tracks = {"reference": audio_track(REFERENCE_AUDIO / sample_id / "reference.mp3"),
                  "hidden_reference": audio_track(REFERENCE_AUDIO / sample_id / "hidden_reference.mp3")}
        if tracks["reference"]["sha256"] != tracks["hidden_reference"]["sha256"]:
            raise ValueError("Public and hidden references differ for " + sample_id)
        for key in TRACKS:
            tracks[key] = audio_track(MODEL_AUDIO / sample_id / (key + ".mp3"))
        trials.append({"dataset": "REAL", "dataset_name": "4floor_2m_deg180_12speech",
                       "dataset_version": "v1.0.1", "sample_id": sample_id,
                       "scene_id": sample_id, "room": "4floor",
                       "recording": entry["recording"],
                       "reference_source": entry["reference"],
                       "reference_alignment_lag_ms": entry["alignment_lag_ms"],
                       "tracks": tracks, "allocation_weight": 1.0})
    blocks = [["real_4floor_{:02d}".format(i) for i in range(1, 13, 2)],
              ["real_4floor_{:02d}".format(i) for i in range(2, 13, 2)]]
    manifest = {"study": "dereverbReal12v1", "dataset_version": "v1.0.1",
                "allocation_version": "real12-two-block-v1",
                "allocation_blocks": blocks,
                "audio_version": {"REAL": "real-noisy-5to20db-rms27-v1+aligned-playback-ref-rms27-v1"},
                "models": models, "trials": trials, "sample_count": 12}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False,
                                   separators=(",", ":")) + "\n")
    return manifest


def build_page(manifest):
    page = PAGE_TEMPLATE.read_text()
    page = replace_once(page, "<title>Dereverb 短批次听评</title>",
                        "<title>实录去混响听评</title>")
    page = replace_once(page, "<span>Dereverb 短批次听评</span>",
                        "<span>实录去混响听评</span>")
    page = replace_once(page, "<h1>每批 7 条，共 28 条</h1>",
                        "<h1>每批 6 条，共 12 条</h1>")
    page = replace_once(
        page,
        "本页包含 ACE 和 AIR 的配对样本。每个测试 ID 独立随机生成四批顺序；同一测试 ID 可以回来继续下一批，已经完成的样本不会再次出现。请为每段声音给出一个符合听感的分数。",
        "本页使用 12 段真实房间录音及同句干净播放参考。每个测试 ID 独立随机排列两批；同一 ID 可回来继续，已完成的样本不会重复。请按说话清晰度、回声和背景声音给出总体分。")
    page = replace_once(page, "<strong>7</strong><span>每批样本</span>",
                        "<strong>6</strong><span>每批样本</span>")
    page = replace_once(page, "<strong>28</strong><span>全部样本</span>",
                        "<strong>12</strong><span>全部样本</span>")
    page = replace_once(page, "<strong>4</strong><span>完成全部批次</span>",
                        "<strong>2</strong><span>完成全部批次</span>")
    page = replace_once(
        page,
        "每个测试 ID 独立随机排列 28 条样本，每批 7 条；可随时保存当前进度，同一 ID 返回时继续未完成批次。已完成样本不会重复；进度保存在本机浏览器。建议用耳机并保持相同音量。",
        "每个测试 ID 独立随机排列 12 条实录，每批 6 条；可随时提交当前进度，同一 ID 返回时继续未完成批次。已完成样本不会重复；进度保存在本机浏览器。建议使用耳机并保持相同音量。")
    page = replace_once(page, "const size = 7;", "const size = 6;")
    page = replace_once(page,
                        "listener-random-v5-short28-random-block-order",
                        "listener-random-v1-real12-two-block-order")
    page = page.replace("p808-short28-v1:", "p808-real12-v1:")
    if "p808-short28-v1:" in page or page.count("p808-real12-v1:") < 2:
        raise ValueError("Real listening progress key was not isolated")
    embedded = re.compile(r"<script>window\.P808_DATA=.*?</script><script>", re.DOTALL)
    replacement = ("<script>window.P808_DATA=" +
                   json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) +
                   ';window.P808_STAGING_ENDPOINT="https://formspree.io/f/mjyypvzy";</script><script>')
    page, count = embedded.subn(lambda _: replacement, page)
    if count != 1:
        raise ValueError("Could not replace the listening manifest in HTML")
    OUTPUT.write_text(page)


def main():
    entries = check_alignment()
    encode_references(entries)
    manifest = build_manifest(entries)
    build_page(manifest)
    print("real listening page", OUTPUT, "trials", len(manifest["trials"]),
          "bytes", OUTPUT.stat().st_size, flush=True)


if __name__ == "__main__":
    main()

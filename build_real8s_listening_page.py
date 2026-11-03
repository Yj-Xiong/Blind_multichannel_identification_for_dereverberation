#!/usr/bin/env python3
"""Publish the eight-second real-recording study with a separate score identity."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
P808 = ROOT / "p808"
BASE = P808 / "real12_manifest.json"
CROPS = P808 / "real8s_crop_windows.json"
OUTPUT_MANIFEST = P808 / "real12_8s_manifest.json"
OUTPUT_PAGE = P808 / "real-recording.html"
LEGACY_ENTRY = P808 / "real-listening.html"
ARCHIVE_PAGE = P808 / "real-listening-10s-archive.html"
TEMPLATE = P808 / "index.html"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def replace_once(page: str, old: str, new: str) -> str:
    if page.count(old) != 1:
        raise ValueError(f"Expected one occurrence of {old[:60]!r}, found {page.count(old)}")
    return page.replace(old, new)


def build_manifest() -> dict:
    old = json.loads(BASE.read_text())
    crops = json.loads(CROPS.read_text())
    if (old["study"] != "dereverbReal12v1" or crops["duration_seconds"] != 8 or
            len(old["trials"]) != 12 or len(crops["samples"]) != 12):
        raise ValueError("Unexpected real-recording source manifests")
    new = {**old, "study": "dereverbReal12v2",
           "allocation_version": "real12-two-block-v2",
           "audio_version": {"REAL": crops["audio_version"]},
           "duration_seconds": 8, "crop_manifest": "real8s_crop_windows.json",
           "trials": []}
    for trial, crop in zip(old["trials"], crops["samples"]):
        if trial["sample_id"] != crop["sample_id"]:
            raise ValueError("Crop manifest sample order mismatch")
        tracks = {}
        for key in trial["tracks"]:
            source = crop["tracks"][key]
            file = P808 / source["listening_mp3"]
            if not file.is_file() or sha256(file) != source["listening_sha256"]:
                raise ValueError(f"Missing or changed eight-second audio: {file}")
            tracks[key] = {"file": source["listening_mp3"],
                           "sha256": source["listening_sha256"]}
        if tracks["reference"]["sha256"] != tracks["hidden_reference"]["sha256"]:
            raise ValueError("Public and hidden references differ")
        new["trials"].append({**trial, "tracks": tracks,
                              "crop_start_seconds": crop["start_seconds"],
                              "crop_end_seconds": crop["end_seconds"]})
    temp = OUTPUT_MANIFEST.with_name(OUTPUT_MANIFEST.name + "." + uuid.uuid4().hex + ".tmp")
    temp.write_text(json.dumps(new, ensure_ascii=False, separators=(",", ":")) + "\n")
    os.replace(temp, OUTPUT_MANIFEST)
    return new


def build_page(manifest: dict) -> None:
    if LEGACY_ENTRY.is_file() and not ARCHIVE_PAGE.is_file():
        shutil.copy2(LEGACY_ENTRY, ARCHIVE_PAGE)
    page = TEMPLATE.read_text()
    page = replace_once(page, "<title>Dereverb 短批次听评</title>", "<title>实录去混响听评</title>")
    page = replace_once(page, "<span>Dereverb 短批次听评</span>", "<span>实录去混响听评</span>")
    page = replace_once(page, '<span class="version">v3</span>',
                        '<span class="version">v2</span>')
    page = replace_once(page, "<h1>每批 7 条，共 28 条</h1>", "<h1>每批 6 条，共 12 条</h1>")
    page = replace_once(page,
        "本页包含 ACE 和 AIR 的配对样本。每个测试 ID 独立随机生成四批顺序；同一测试 ID 可以回来继续下一批，已经完成的样本不会再次出现。请为每段声音给出一个符合听感的分数。",
        "本页包含 12 条真实房间录音，每段 8 秒。每个测试 ID 独立随机排列两批；同一 ID 可回来继续，已完成的样本不会重复。8 秒音频采用新的任务版本，旧版评分单独保存。")
    page = replace_once(page, "<strong>7</strong><span>每批样本</span>",
                        "<strong>6</strong><span>每批样本</span>")
    page = replace_once(page, "<strong>28</strong><span>全部样本</span>",
                        "<strong>12</strong><span>全部样本</span>")
    page = replace_once(page, "<strong>4</strong><span>完成全部批次</span>",
                        "<strong>2</strong><span>完成全部批次</span>")
    page = replace_once(page,
        "每个测试 ID 独立随机排列 28 条样本，每批 7 条；可随时保存当前进度，同一 ID 返回时继续未完成批次。已完成样本不会重复；进度保存在本机浏览器。建议用耳机并保持相同音量。",
        "每个测试 ID 独立随机排列 12 条实录，每批 6 条；可随时提交当前进度，同一 ID 返回时继续未完成批次。已完成样本不会重复；进度保存在本机浏览器。建议使用耳机并保持相同音量。")
    page = replace_once(page, "const size = 7;", "const size = 6;")
    page = replace_once(page, "listener-random-v5-short28-random-block-order",
                        "listener-random-v2-real12-two-block-order")
    if page.count("p808-short28-v1:") < 2:
        raise ValueError("Missing short-study browser storage key")
    page = page.replace("p808-short28-v1:", "p808-real12-v2:")
    page = replace_once(page, "'p808-short28-' + state.listener",
                        "'p808-real12-v2-' + state.listener")
    page = replace_once(page, "'dereverb-p808-short28-v1'",
                        "'dereverb-p808-real12-v2'")
    embedded = re.compile(r"<script>window\.P808_DATA=.*?</script><script>", re.DOTALL)
    replacement = ("<script>window.P808_DATA=" +
                   json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) +
                   ';window.P808_STAGING_ENDPOINT="https://formspree.io/f/mjyypvzy";</script><script>')
    page, count = embedded.subn(lambda _: replacement, page)
    if count != 1:
        raise ValueError("Could not replace embedded listening manifest")
    temp = OUTPUT_PAGE.with_name(OUTPUT_PAGE.name + "." + uuid.uuid4().hex + ".tmp")
    temp.write_text(page)
    os.replace(temp, OUTPUT_PAGE)
    redirect = ('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
                '<meta http-equiv="refresh" content="0; url=real-recording.html">'
                '<link rel="canonical" href="real-recording.html">'
                '<title>实录听评已迁移</title></head><body>'
                '<p>实录听评入口已迁移至 <a href="real-recording.html">real-recording.html</a>。</p>'
                '<script>location.replace("real-recording.html");</script></body></html>')
    temp = LEGACY_ENTRY.with_name(LEGACY_ENTRY.name + "." + uuid.uuid4().hex + ".tmp")
    temp.write_text(redirect)
    os.replace(temp, LEGACY_ENTRY)
    print("complete", OUTPUT_PAGE, "study", manifest["study"],
          "samples", len(manifest["trials"]), flush=True)


def main() -> None:
    manifest = build_manifest()
    build_page(manifest)


if __name__ == "__main__":
    main()

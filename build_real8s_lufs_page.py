#!/usr/bin/env python3
"""Build the BS.1770 loudness-normalized real-recording listening page."""

from pathlib import Path
import build_real8s_listening_page as base

ROOT = Path(__file__).resolve().parent
P808 = ROOT / "p808"
base.CROPS = P808 / "real8s_lufs_crop_manifest.json"
base.BASE = P808 / "real12_8s_manifest.json"
base.OUTPUT_MANIFEST = P808 / "real12_lufs_manifest.json"
base.OUTPUT_PAGE = P808 / "real-recording-lufs.html"
base.LEGACY_ENTRY = P808 / "real-recording.html"
base.ARCHIVE_PAGE = P808 / "real-recording-rms8s-archive.html"
base.STUDY_ID = "dereverbReal12v3"
base.ALLOCATION_VERSION = "real12-two-block-v3"
base.AUDIO_VERSION = "real8s-lufs23-tp1-v1"
base.SAMPLING_VERSION = "listener-random-v3-real12-equal-remaining-block-order"
base.STORAGE_PREFIX = "p808-real12-v3-"
base.SUBMISSION_TYPE = "dereverb-p808-real12-v3"
base.REDIRECT_TARGET = "real-recording-lufs.html"

if __name__ == "__main__":
    manifest = base.build_manifest()
    base.build_page(manifest)

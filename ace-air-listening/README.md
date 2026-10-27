# ACE / AIR v1.0.1 Listening Study

This directory is an independent GitHub Pages entry for complete ACE coverage
and one 30 dB sample from each AIR scene. It uses a MUSHRA-style 0–100 scale, a
visible dry reference, a hidden dry reference, a 3.5 kHz low-pass anchor, and
an unprocessed anchor. The eight enhancement methods are blinded and
randomized separately for each trial. This is a remote listening study, not a
controlled ITU-R BS.1534 test.

## Coverage and batches

- ACE Chromebook: 56 samples, 14 RIR scenes × 4 SNR levels.
- AIR: 107 samples, one 30 dB sample from each of 107 RIR scenes.
- Every sample appears in exactly one batch within its dataset. Batches have
  eight samples, except the final AIR batch, which has three. There are seven
  ACE and 14 AIR batches. Each ACE batch contains two samples at each SNR from
  eight distinct scenes. Listeners can complete multiple batches in sequence.
- The batch selector and direct links `?dataset=ACE&batch=1` or
  `?dataset=AIR&batch=1` let the organizer assign work and cover all 163
  samples. Each batch is submitted separately. A pseudonymous listener ID is
  accepted, and completed batches are marked in the same browser.
- Each trial uses the same dry speech and noisy input across all eight models.
  Reference and input come from the dataset metadata; model output comes from
  the corresponding `samples.jsonl` manifest.

## Build

`build_assets.py` requires `soundfile` and ffmpeg. Pass the ACE/AIR data roots,
the Open-Bench inference result root, and this directory as `--output`. Run it
in the cluster CPU queue because it exports thousands of audio assets. The
local submission record is `../../build_ace_air_subjective_assets.sh` in the
AutoResearch workspace.

The generator writes `manifest.json` and MP3 files in `audio/`. It fails on
missing model output, non-16 kHz input/reference audio, or a changed dataset
sample count. Every published MP3 has a SHA-256 value in the manifest.

## Collection

`index.html` submits complete batches to the existing Formspree endpoint with
type `ace56-air30-se-v1`. The submitted record includes dataset, batch number,
sample IDs, anonymized method order, all 0–100 ratings, and dataset version.
Submission failure downloads a JSON backup; listeners can also download a copy
after successful submission. The organizer should assign all 21 batches and
verify receipt before analyzing model rankings or objective correlations.

Reference: [ITU-R BS.1534](https://www.itu.int/rec/R-REC-BS.1534/en).

# Dereverb Listening Study

This GitHub Pages study evaluates all 56 ACE Chromebook samples and one 30 dB
sample from each of 107 AIR RIR scenes. The listener completes ACE first, then
AIR, and submits one combined record covering 163 samples. Progress is kept in
the same browser under `ace56-air30-joint-v3`; previous study versions remain
separate because their candidate sets and score scales differ.

Each trial has an additional visible dry reference player that is not scored.
The ten blinded, scored tracks contain a hidden dry reference, an unprocessed
input, and eight model outputs. Candidate order is deterministic
for the listener and sample. Ratings use a 0.0–10.0 scale in
0.1-point increments. More obvious reverberation merits a lower score;
residual noise and processing artifacts also matter. All ten scores within a
trial must be different before the listener can advance. This remote study is
MUSHRA-style, not a controlled ITU-R BS.1534 test. The navigation allows
revisiting completed samples and the first incomplete sample; AIR remains
inaccessible until all ACE samples are rated.

The 163-sample record is sent once to the existing Formspree endpoint with
type `ace56-air30-joint-v3`. The `candidateIds` array defines the order of
each trial's numeric `scores` array; its numeric `order` array records the
presentation order. The record includes the score scale, sample IDs, listener
metadata, dataset version, and submission time. A failed submission downloads
the record as JSON; a copy is also available after success. Older records
must not be combined with this protocol without explicit review.

`build_assets.py` generates the manifest and MP3 files from the ACE/AIR v1.0.1
dataset roots and the eight model inference manifests. Use the cluster CPU
queue for this bulk export; the local submission script is
`../../build_ace_air_subjective_assets.sh` in the AutoResearch workspace.
Every published MP3 has a SHA-256 value in `manifest.json`. The header uses the
center logo embedded in the Open-Bench presentation template.

Reference: [ITU-R BS.1534](https://www.itu.int/rec/R-REC-BS.1534/en).

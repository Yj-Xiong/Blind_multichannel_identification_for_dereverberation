# Dereverb Listening Study

The same audio and scoring protocol is available through three entry points:

| Entry | Files | Submission type | Browser storage |
| --- | --- | --- | --- |
| `index.html` | All 56 ACE samples, then one 30 dB sample from each of 107 AIR scenes | `ace56-air30-joint-v3` | `ace56-air30-joint-v3` |
| `ace.html` | All 56 ACE samples | `ace56-only-v1` | `ace56-only-v1` |
| `air.html` | 107 AIR scenes at 30 dB | `air30-only-v1` | `air30-only-v1` |

Each entry saves and submits independently. Opening the ACE or AIR entry does
not change progress in the joint study; results are not copied between entries.
The joint study still requires all 163 samples before its combined submission.

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

Each completed record is sent once to the existing Formspree endpoint with
the entry's submission type above. The `candidateIds` array defines the order of
each trial's numeric `scores` array; its numeric `order` array records the
presentation order. The record includes the score scale, sample IDs, listener
metadata, dataset version, audio version, and submission time. A failed submission downloads
the record as JSON; a copy is also available after success. Older records
must not be combined with this protocol without explicit review.

The new AIR files live under `audio/air-rms27-peak1p5-v1/`, so browser caches
cannot substitute older MP3s. The manifest is fetched without cache. Existing
scores for the 56 ACE trials remain in browser storage after refresh; scores
from the older AIR audio are cleared and the previous state is copied under
`ace56-air30-joint-v3:before-air-rms27-peak1p5-v1`. The browser does not clear
the listener's ACE ratings, session ID, or candidate order.

`build_assets.py` generates the manifest and MP3 files from the ACE/AIR v1.0.1
dataset roots and the eight model inference manifests. Use the cluster CPU
queue for this bulk export; the local submission script is
`../../build_ace_air_subjective_assets.sh` in the AutoResearch workspace.
Every published MP3 has a SHA-256 value in `manifest.json`. The header uses the
center logo embedded in the Open-Bench presentation template.

Reference: [ITU-R BS.1534](https://www.itu.int/rec/R-REC-BS.1534/en).

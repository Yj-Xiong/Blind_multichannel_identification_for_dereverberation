# Dereverb Listening Study

The same audio and scoring protocol is available through three entry points:

| Entry | Files | Submission type | Browser storage |
| --- | --- | --- | --- |
| `index.html` | All 56 ACE samples, then one 30 dB sample from each of 107 AIR scenes | `ace56-air30-joint-v3` | `ace56-air30-joint-v3` |
| `ace.html` | All 56 ACE samples | `ace56-only-v1` | `ace56-only-v1` |
| `air.html` | 107 AIR scenes at 30 dB | `air30-only-v1` | `air30-only-v1` |
| `batch.html` | 163 normalized ACE/AIR samples, 10 samples per round | `dereverb-p808-batch-v1` | `dereverb-p808-batch-v1:<listener>` |

Each entry saves and submits independently. Opening the ACE or AIR entry does
not change progress in the joint study; results are not copied between entries.
The joint study still requires all 163 samples before its combined submission.

The batch entry follows the P.808 crowdsourcing organization principles:
short independent tasks, randomized sample selection, listener setup
information, a visible reference, and one submission per completed task. This
study adds a project-specific 0.0–10.0 ranking scale with 0.1 increments.
The ten anonymous versions for each sample must have distinct scores so that
the subjective result produces an unambiguous ranking; this distinct-score
constraint is an extension for this benchmark, not a claim that the page is a
full conformance test of every P.808 procedure.

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

The batch playback audio for both ACE and AIR is gain matched within each trial. The source WAV first
channel is measured before encoding; a gain-only adjustment targets −27 dBFS
whole-file RMS with a −1.5 dBFS peak ceiling. The reference, hidden reference,
unprocessed input, and eight model outputs use the same rule. A file that hits
the peak ceiling may remain below the RMS target; the per-track audit is saved
as `all_loudness_report.json`. The older joint, ACE-only, and AIR-only
entries retain their prior audio paths and browser state.

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

References: [ITU-T P.808](https://www.itu.int/rec/T-REC-P.808/en),
[ITU-R BS.1534](https://www.itu.int/rec/R-REC-BS.1534/en).

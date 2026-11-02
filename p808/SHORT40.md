# Dereverb short listening study

The current page uses 40 trials: 14 ACE samples at 10 dB, 14 AIR samples at 20 dB, and 12 real four-channel recordings with added recorded ambient noise between 5 and 20 dB. Each batch contains 10 trials. Paired trials have a public reference player plus 10 scored clips, including a hidden reference; real recordings have no reference and have 9 scored clips.

The audio and selection are recorded in `short40_manifest.json`, `short40_selection.json`, and `real_noisy_5to20db_v1/manifest.json`. The original 163-trial page is preserved as `legacy-163.html` and uses a different browser storage key. The new page saves progress under `p808-short40-v1:<listener ID>`.

## Offline distribution

`short40_manifest.json` divides the 40 trials into four disjoint blocks of 10, each containing ACE, AIR, and real recordings. Listeners enter their own test ID. The ID deterministically selects the first block; later batches rotate through the remaining blocks without repeating samples. The four blocks have equal initial probability, 1/4 each. For any number N of listeners who each finish one batch, each sample has an expected N/4 ratings, but actual block counts can differ. No numbered invitation links are used.

Weights in `short40_allocation_weights.json` can bias the first block for new listeners. To update weights from the private score archive, run `python update_short40_weights.py --latest-csv <private-repo>/scores/latest.csv`, then rebuild the manifest and page and publish them. Existing listener orders remain saved in the browser. Automatic live allocation requires a shared service that reserves and records assignments centrally.

## Build

After all eight real-recording inference jobs are complete:

```bash
python select_short40_trials.py
python build_short40_manifest.py
python build_p808_final.py
```

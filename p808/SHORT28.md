# Dereverb short listening study

The public short study contains 28 paired trials: 14 ACE samples at 10 dB
and 14 AIR samples at 20 dB. The 12 real four-channel recordings are kept out
of this study. Each batch contains 7 trials, and four disjoint batches cover
all 28 trials.

Listeners enter their own test ID. The ID deterministically generates a random
permutation of the four blocks. The first block is selected with equal
probability; each later block is selected from the remaining blocks, so no
sample repeats for the same listener.

The page uses `p808/short28_manifest.json` and stores browser progress under
`p808-short28-v1:<listener ID>`. A checkpoint contains the current CSV but does
not use the email endpoint. A completed batch is sent to the notification
endpoint.

## Build

```bash
python build_short40_manifest.py
python build_p808_final.py
```

# Blind Multichannel Identification for Dereverberation Audio Demo

This repository hosts the audio demo and subjective listening evaluation page for the paper **Investigating Blind Multichannel Identification Algorithms and Their Application for Speech Dereverberation Using MINT**.

## Pages

After GitHub Pages is enabled from the `gh-pages` branch, the pages are available at:

- Main audio demo: `https://yj-xiong.github.io/Blind_multichannel_identification_for_dereverberation/`
- Subjective listening evaluation: `https://yj-xiong.github.io/Blind_multichannel_identification_for_dereverberation/subjective.html`
- Experimental MUSHRA-style evaluation: `https://yj-xiong.github.io/Blind_multichannel_identification_for_dereverberation/mushra.html`

## Local preview

Run a local static server from the repository root:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/index.html
http://localhost:8000/subjective.html
http://localhost:8000/mushra.html
```

Avoid opening the HTML files directly with `file://`, because browser security rules may block loading `audio-manifest.json`.

## Repository structure

```text
.
├── index.html                  # Main audio demo page
├── subjective.html             # Subjective listening evaluation page
├── styles.css                  # Shared styles
├── audio-manifest.json         # Generated WAV file manifest
├── paper.pdf                   # Linked paper PDF
├── src/
│   ├── app.js                  # Main demo UI
│   ├── audio-visualizer.js     # Waveform/spectrogram rendering
│   └── subjective.js           # Listening-test scoring and Formspree submission
├── scripts/
│   └── generate-manifest.mjs   # Regenerates audio-manifest.json
├── sim1024_rho0.1/             # BMCI-MINT audio examples used in the paper table
├── sim1024_rho0.5/             # Additional audio examples hidden from the main UI
└── wpe_gwpe_noisy/             # WPE/GWPE baseline audio examples
```

## Regenerating the audio manifest

If WAV files are added, removed, or renamed, regenerate the manifest:

```powershell
node scripts/generate-manifest.mjs
```

The script scans all `.wav` files, extracts metadata from filenames and folders, and writes `audio-manifest.json`.

## Subjective listening evaluation

The subjective page is designed for listener testing:

- The page supports English and Chinese through the `Select Language` control.
- All examples begin unrated, so unscored items are distinguishable from scored items.
- Listeners score each audio example from 1 to 5.
- Integer scores can be selected directly.
- A separate `+0.5` / `−0.5` control allows half-point adjustment.
- The current score is displayed between the integer score buttons and the half-point controls.
- The scoring guidance panel stays sticky at the top of the page.
- The SNR selector is placed in the scoring guidance header.
- Submit is blocked until every audio example has a score.
- If any item is still unrated, the page shows an error and scrolls to the first unrated example.
- Results are submitted through Formspree only after all examples are rated.
- If Formspree submission fails, the page downloads a backup JSON file.

Current Formspree endpoint:

```text
https://formspree.io/f/mpqgvpvo
```

The submitted payload includes listener ID, session note, rated count, total count, and full score JSON.

## MUSHRA-style evaluation

The experimental MUSHRA page (`mushra.html`) combines the project visual style with a WebMUSHRA-like trial workflow:

- Each trial corresponds to one SNR condition.
- Users move through trials with `Previous` and `Next`.
- The submission section is hidden until the final trial is completed and `Review submission` is selected.
- Methods are the same as the subjective page: WPE, GWPE, MINT-N, MINT-R, MINT-ℓp, MINT-Eℓp, and MINT-Reference.
- Scores use a 0–100 scale.
- The page supports English and Chinese, with the language selector defaulting to `Select Language`.
- Submit is blocked until all MUSHRA ratings are complete.
- Results are submitted to the same Formspree endpoint and use payload type `nc2026-mushra-scores`.

## Updating GitHub Pages

This repository is published from the `gh-pages` branch.

Typical update flow:

```powershell
git status
git add .
git commit -m "Describe the update"
git push origin gh-pages
```

GitHub Pages may take a few minutes to redeploy. If the browser still shows an old version, use `Ctrl + F5` to force refresh.

## Notes

- Keep audio paths relative to the repository root.
- Do not rename WAV files without regenerating `audio-manifest.json`.
- The listening-test page intentionally omits raw/unprocessed examples and noisy-input branches; it focuses on the spectral-subtraction branch used for subjective scoring.

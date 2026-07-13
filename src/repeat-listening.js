const REPEATS = Array.from({ length: 20 }, (_, index) => index + 1);

const INPUTS = {
  noisy: {
    label: 'Noisy',
    root: 'floor4_repeat_audio',
    regKeys: { reg005: 'reg005', reg01: 'reg01' },
    files: {
      input: 'raw_noisy_mics.wav',
      elp: 'raw_BCI_ELp_p=1.0.wav',
      lp: 'raw_BCI_Lp_p=1.0.wav',
      nmcflms: 'raw_BCI_NMCFLMS.wav',
      rnmcflms: 'raw_BCI_RNMCFLMS.wav',
      oracle: 'raw_Oracle_MINT.wav',
    },
  },
  specsub: {
    label: 'Spectral-Subtraction',
    root: 'floor4_repeat_audio_spectral-subtraction',
    regKeys: { reg005: 'reg0p05', reg01: 'reg0p1' },
    files: {
      input: 'raw_specsub_mics.wav',
      elp: 'raw_SpecSub_BCI_ELp_p=1.0.wav',
      lp: 'raw_SpecSub_BCI_Lp_p=1.0.wav',
      nmcflms: 'raw_SpecSub_BCI_NMCFLMS.wav',
      rnmcflms: 'raw_SpecSub_BCI_RNMCFLMS.wav',
      oracle: 'raw_SpecSub_Oracle_MINT.wav',
    },
  },
};

const METHODS = [
  { key: 'input', label: input => input.label },
  { key: 'elp', label: () => 'MINT-Eℓp' },
  { key: 'lp', label: () => 'MINT-ℓp' },
  { key: 'nmcflms', label: () => 'MINT-NMCFLMS' },
  { key: 'rnmcflms', label: () => 'MINT-RNMCFLMS' },
  { key: 'oracle', label: () => 'MINT-Reference' },
];

const REGULARIZATIONS = [
  { key: 'reg005', label: 'λ = 0.05', sample: 'Sample 11', sampleId: 'sample_11', sampleDir: 'sample11' },
  { key: 'reg01', label: 'λ = 0.1', sample: 'Sample 12', sampleId: 'sample_12', sampleDir: 'sample12' },
];

const BASELINES = {
  sample11: {
    clean: 'floor4_repeat_audio/sample11/raw_11.wav',
    wpe: 'floor4_repeat_audio/sample11/raw11_WPE.wav',
    gwpe: 'floor4_repeat_audio/sample11/raw11_GWPE_K50_d2_i2.wav',
  },
  sample12: {
    clean: 'floor4_repeat_audio/sample12/raw_12.wav',
    wpe: 'floor4_repeat_audio/sample12/raw12_WPE.wav',
    gwpe: 'floor4_repeat_audio/sample12/raw12_GWPE_K50_d2_i2.wav',
  },
};

const state = {
  repeat: 1,
  snr: 'snr5',
  input: 'noisy',
};

const els = {
  repeatFilter: document.querySelector('#repeat-filter'),
  snrFilter: document.querySelector('#snr-filter'),
  inputFilter: document.querySelector('#input-filter'),
  status: document.querySelector('#repeat-status'),
  content: document.querySelector('#repeat-content'),
};

function makeOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function audioPath(reg, snr, repeat, methodKey) {
  const input = INPUTS[state.input];
  const file = input.files[methodKey];

  if (state.input === 'specsub') {
    const regKey = input.regKeys[reg.key];
    return `${input.root}/${regKey}/thchs/${reg.sampleId}/deg90/${snr}/repeats_${repeat}/${file}`;
  }

  const regKey = input.regKeys[reg.key];
  return `${input.root}/${regKey}/${snr}/repeat_${repeat}/${file}`;
}

function makeAudio(src) {
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.preload = 'none';
  audio.src = encodeURI(src);
  return audio;
}

function renderBaselineCards(reg) {
  const baseline = BASELINES[reg.sampleDir];
  const cards = [
    ['Clean', baseline.clean],
    ['WPE', baseline.wpe],
    ['GWPE', baseline.gwpe],
  ];

  return cards.map(([label, src]) => {
    const row = document.createElement('article');
    row.className = 'audio-row repeat-audio-row';
    row.innerHTML = `
      <div class="audio-meta">
        <h5>${label}</h5>
        <div class="badges">
          <span class="badge muted">${reg.sample}</span>
          <span class="badge muted">Fixed baseline</span>
        </div>
      </div>
    `;
    row.append(makeAudio(src));
    return row;
  });
}

function renderMethodCard(reg, method) {
  const input = INPUTS[state.input];
  const row = document.createElement('article');
  row.className = 'audio-row repeat-audio-row';
  row.innerHTML = `
    <div class="audio-meta">
      <h5>${method.label(input)}</h5>
      <div class="badges">
        <span class="badge">Repeat ${state.repeat}</span>
        <span class="badge muted">${state.snr.replace('snr', 'SNR ')} dB</span>
        <span class="badge muted">${input.label} input</span>
      </div>
    </div>
  `;
  row.append(makeAudio(audioPath(reg, state.snr, state.repeat, method.key)));
  return row;
}

function render() {
  els.content.innerHTML = '';

  for (const reg of REGULARIZATIONS) {
    const section = document.createElement('section');
    section.className = 'panel repeat-section';
    section.innerHTML = `
      <div class="section-heading repeat-section-heading">
        <div>
          <p class="eyebrow">${reg.sample}</p>
          <h2>${reg.label}</h2>
        </div>
        <span class="badge">Repeat ${state.repeat}</span>
      </div>
    `;

    const baselineGroup = document.createElement('div');
    baselineGroup.className = 'repeat-subsection';
    baselineGroup.innerHTML = '<h3>Fixed examples</h3>';
    const baselineGrid = document.createElement('div');
    baselineGrid.className = 'repeat-grid baseline-grid';
    baselineGrid.append(...renderBaselineCards(reg));
    baselineGroup.append(baselineGrid);

    const methodGroup = document.createElement('div');
    methodGroup.className = 'repeat-subsection';
    methodGroup.innerHTML = '<h3>Selected repeat outputs</h3>';
    const methodGrid = document.createElement('div');
    methodGrid.className = 'repeat-grid';
    methodGrid.append(...METHODS.map(method => renderMethodCard(reg, method)));
    methodGroup.append(methodGrid);

    section.append(baselineGroup, methodGroup);
    els.content.append(section);
  }

  els.status.textContent = `Showing repeat ${state.repeat}, ${state.snr.replace('snr', 'SNR ')} dB, ${INPUTS[state.input].label} input.`;
}

function init() {
  for (const repeat of REPEATS) {
    els.repeatFilter.append(makeOption(String(repeat), `Repeat ${repeat}`));
  }

  els.repeatFilter.value = String(state.repeat);
  els.snrFilter.value = state.snr;
  els.inputFilter.value = state.input;

  els.repeatFilter.addEventListener('change', () => {
    state.repeat = Number(els.repeatFilter.value);
    render();
  });

  els.snrFilter.addEventListener('change', () => {
    state.snr = els.snrFilter.value;
    render();
  });

  els.inputFilter.addEventListener('change', () => {
    state.input = els.inputFilter.value;
    render();
  });

  render();
}

init();

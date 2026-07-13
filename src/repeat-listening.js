const REPEATS = Array.from({ length: 20 }, (_, index) => index + 1);

const METHODS = [
  { key: 'noisy', label: 'Noisy', file: 'raw_noisy_mics.wav', baseline: true },
  { key: 'wpe', label: 'WPE', file: 'raw_WPE.wav', baseline: true },
  { key: 'gwpe', label: 'GWPE', file: 'raw_GWPE_K50_d2_i2.wav', baseline: true },
  { key: 'elp', label: 'MINT-Eℓp', file: 'raw_BCI_ELp_p=1.0.wav' },
  { key: 'lp', label: 'MINT-ℓp', file: 'raw_BCI_Lp_p=1.0.wav' },
  { key: 'nmcflms', label: 'MINT-NMCFLMS', file: 'raw_BCI_NMCFLMS.wav' },
  { key: 'rnmcflms', label: 'MINT-RNMCFLMS', file: 'raw_BCI_RNMCFLMS.wav' },
  { key: 'oracle', label: 'MINT-Reference', file: 'raw_Oracle_MINT.wav' },
];

const REGULARIZATIONS = [
  { key: 'reg01', label: 'MINT reg = 0.1', sample: 'Sample 12', sampleDir: 'sample12' },
  { key: 'reg005', label: 'MINT reg = 0.05', sample: 'Sample 11', sampleDir: 'sample11' },
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
};

const els = {
  repeatFilter: document.querySelector('#repeat-filter'),
  snrFilter: document.querySelector('#snr-filter'),
  status: document.querySelector('#repeat-status'),
  content: document.querySelector('#repeat-content'),
};

function makeOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function audioPath(regKey, snr, repeat, file) {
  return `floor4_repeat_audio/${regKey}/${snr}/repeat_${repeat}/${file}`;
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
    ['Clean raw', baseline.clean],
    ['WPE baseline', baseline.wpe],
    ['GWPE baseline', baseline.gwpe],
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
  const row = document.createElement('article');
  row.className = 'audio-row repeat-audio-row';
  row.innerHTML = `
    <div class="audio-meta">
      <h5>${method.label}</h5>
      <div class="badges">
        <span class="badge">Repeat ${state.repeat}</span>
        <span class="badge muted">${state.snr.replace('snr', 'SNR ')} dB</span>
        ${method.baseline ? '<span class="badge muted">Baseline</span>' : ''}
      </div>
    </div>
  `;
  row.append(makeAudio(audioPath(reg.key, state.snr, state.repeat, method.file)));
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
    baselineGroup.innerHTML = '<h3>Fixed raw baselines</h3>';
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

  els.status.textContent = `Showing repeat ${state.repeat}, ${state.snr.replace('snr', 'SNR ')} dB.`;
}

function init() {
  for (const repeat of REPEATS) {
    els.repeatFilter.append(makeOption(String(repeat), `Repeat ${repeat}`));
  }

  els.repeatFilter.value = String(state.repeat);
  els.snrFilter.value = state.snr;

  els.repeatFilter.addEventListener('change', () => {
    state.repeat = Number(els.repeatFilter.value);
    render();
  });

  els.snrFilter.addEventListener('change', () => {
    state.snr = els.snrFilter.value;
    render();
  });

  render();
}

init();

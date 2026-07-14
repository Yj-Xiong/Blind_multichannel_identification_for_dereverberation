const REPEATS = Array.from({ length: 20 }, (_, index) => index + 1);

const INPUTS = {
  noisy: {
    label: 'Noisy',
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

const REGULARIZATIONS = {
  reg005: { label: 'λ = 0.05', thchsKey: 'reg0p05' },
  reg01: { label: 'λ = 0.1', thchsKey: 'reg0p1' },
};

const CORPORA = {
  thchs: {
    label: 'THCHS',
    supportedInputs: ['noisy', 'specsub'],
    sections: [
      { sample: 'Sample 1', sampleId: 'sample_11', sampleDir: 'sample11', regs: ['reg005'] },
      { sample: 'Sample 2', sampleId: 'sample_12', sampleDir: 'sample12', regs: ['reg01'] },
    ],
    baselines: section => ({
      clean: `floor4_repeat_audio/${section.sampleDir}/raw_${section.sampleDir.replace('sample', '')}.wav`,
      wpe: `floor4_repeat_audio/${section.sampleDir}/raw${section.sampleDir.replace('sample', '')}_WPE.wav`,
      gwpe: `floor4_repeat_audio/${section.sampleDir}/raw${section.sampleDir.replace('sample', '')}_GWPE_K50_d2_i2.wav`,
    }),
    audioPath: (section, regKey, snr, repeat, methodKey, inputKey) => {
      const file = INPUTS[inputKey].files[methodKey];

      if (inputKey === 'specsub') {
        return `floor4_repeat_audio_spectral-subtraction/${REGULARIZATIONS[regKey].thchsKey}/thchs/${section.sampleId}/deg90/${snr}/repeats_${repeat}/${file}`;
      }

      return `floor4_repeat_audio/${regKey}/${snr}/repeat_${repeat}/${file}`;
    },
  },
  timit: {
    label: 'TIMIT',
    supportedInputs: ['noisy', 'specsub'],
    sections: [
      { sample: 'Sample 1', sampleDir: 'sample5', rawId: '5', regs: ['reg005', 'reg01'] },
      { sample: 'Sample 2', sampleDir: 'sample7', rawId: '7', regs: ['reg005', 'reg01'] },
    ],
    baselines: (section, regKey, snr, inputKey) => {
      const root = inputKey === 'specsub' ? 'floor4_repeat_TIMIT+SS' : 'floor4_repeat_TIMIT';

      if (inputKey === 'specsub') {
        return {
          clean: `${root}/${section.sampleDir}/baselines/raw_${section.rawId}.wav`,
          wpe: `${root}/${section.sampleDir}/${regKey}/${snr}/baselines/raw_SpecSub_WPE.wav`,
          gwpe: `${root}/${section.sampleDir}/${regKey}/${snr}/baselines/raw_SpecSub_GWPE_K50_d2_i2.wav`,
        };
      }

      return {
        clean: `${root}/${section.sampleDir}/baselines/raw_${section.rawId}.wav`,
        wpe: `${root}/${section.sampleDir}/baselines/raw${section.rawId}_WPE.wav`,
        gwpe: `${root}/${section.sampleDir}/baselines/raw${section.rawId}_GWPE_K50_d2_i2.wav`,
      };
    },
    audioPath: (section, regKey, snr, repeat, methodKey, inputKey) => {
      const root = inputKey === 'specsub' ? 'floor4_repeat_TIMIT+SS' : 'floor4_repeat_TIMIT';
      const file = INPUTS[inputKey].files[methodKey];
      return `${root}/${section.sampleDir}/${regKey}/${snr}/repeat_${repeat}/${file}`;
    },
  },
};

const state = {
  repeat: 1,
  snr: 'snr5',
  corpus: 'thchs',
  input: 'noisy',
};

const els = {
  repeatFilter: document.querySelector('#repeat-filter'),
  snrFilter: document.querySelector('#snr-filter'),
  corpusFilter: document.querySelector('#corpus-filter'),
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

function selectedCorpus() {
  return CORPORA[state.corpus];
}

function updateInputAvailability() {
  const corpus = selectedCorpus();

  for (const option of els.inputFilter.options) {
    option.disabled = !corpus.supportedInputs.includes(option.value);
  }

  if (!corpus.supportedInputs.includes(state.input)) {
    state.input = corpus.supportedInputs[0];
  }

  els.inputFilter.value = state.input;
  els.inputFilter.disabled = corpus.supportedInputs.length === 1;
}

function audioPath(section, regKey, snr, repeat, methodKey) {
  return selectedCorpus().audioPath(section, regKey, snr, repeat, methodKey, state.input);
}

function makeAudio(src) {
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.preload = 'none';
  audio.src = encodeURI(src);
  return audio;
}

function renderBaselineCards(section, regKey) {
  const baseline = selectedCorpus().baselines(section, regKey, state.snr, state.input);
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
          <span class="badge muted">${section.sample}</span>
          <span class="badge muted">${REGULARIZATIONS[regKey].label}</span>
          <span class="badge muted">Fixed baseline</span>
        </div>
      </div>
    `;
    row.append(makeAudio(src));
    return row;
  });
}

function renderMethodCard(section, regKey, method) {
  const input = INPUTS[state.input];
  const row = document.createElement('article');
  row.className = 'audio-row repeat-audio-row';
  row.innerHTML = `
    <div class="audio-meta">
      <h5>${method.label(input)}</h5>
      <div class="badges">
        <span class="badge">Repeat ${state.repeat}</span>
        <span class="badge muted">${state.snr.replace('snr', 'SNR ')} dB</span>
        <span class="badge muted">${REGULARIZATIONS[regKey].label}</span>
        <span class="badge muted">${input.label} input</span>
      </div>
    </div>
  `;
  row.append(makeAudio(audioPath(section, regKey, state.snr, state.repeat, method.key)));
  return row;
}

function renderRegGroup(section, regKey) {
  const group = document.createElement('div');
  group.className = 'repeat-subsection';

  const baselineGroup = document.createElement('div');
  baselineGroup.className = 'repeat-subsection';
  baselineGroup.innerHTML = `<h3>${REGULARIZATIONS[regKey].label} · Fixed examples</h3>`;
  const baselineGrid = document.createElement('div');
  baselineGrid.className = 'repeat-grid baseline-grid';
  baselineGrid.append(...renderBaselineCards(section, regKey));
  baselineGroup.append(baselineGrid);

  const methodGroup = document.createElement('div');
  methodGroup.className = 'repeat-subsection';
  methodGroup.innerHTML = `<h3>${REGULARIZATIONS[regKey].label} · Selected repeat outputs</h3>`;
  const methodGrid = document.createElement('div');
  methodGrid.className = 'repeat-grid';
  methodGrid.append(...METHODS.map(method => renderMethodCard(section, regKey, method)));
  methodGroup.append(methodGrid);

  group.append(baselineGroup, methodGroup);
  return group;
}

function render() {
  updateInputAvailability();
  els.content.innerHTML = '';

  const corpus = selectedCorpus();

  for (const sectionConfig of corpus.sections) {
    const section = document.createElement('section');
    section.className = 'panel repeat-section';
    section.innerHTML = `
      <div class="section-heading repeat-section-heading">
        <div>
          <p class="eyebrow">${corpus.label}</p>
          <h2>${sectionConfig.sample}</h2>
        </div>
        <span class="badge">Repeat ${state.repeat}</span>
      </div>
    `;

    section.append(...sectionConfig.regs.map(regKey => renderRegGroup(sectionConfig, regKey)));
    els.content.append(section);
  }

  els.status.textContent = `Showing ${corpus.label}, repeat ${state.repeat}, ${state.snr.replace('snr', 'SNR ')} dB, ${INPUTS[state.input].label} input.`;
}

function init() {
  for (const repeat of REPEATS) {
    els.repeatFilter.append(makeOption(String(repeat), `Repeat ${repeat}`));
  }

  els.repeatFilter.value = String(state.repeat);
  els.snrFilter.value = state.snr;
  els.corpusFilter.value = state.corpus;
  els.inputFilter.value = state.input;

  els.repeatFilter.addEventListener('change', () => {
    state.repeat = Number(els.repeatFilter.value);
    render();
  });

  els.snrFilter.addEventListener('change', () => {
    state.snr = els.snrFilter.value;
    render();
  });

  els.corpusFilter.addEventListener('change', () => {
    state.corpus = els.corpusFilter.value;
    render();
  });

  els.inputFilter.addEventListener('change', () => {
    state.input = els.inputFilter.value;
    render();
  });

  render();
}

init();

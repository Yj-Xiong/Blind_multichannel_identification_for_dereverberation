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
  { key: 'elp', label: () => 'MINT-Eℓp' },
  { key: 'lp', label: () => 'MINT-ℓp' },
  { key: 'nmcflms', label: () => 'MINT-NMCFLMS' },
  { key: 'rnmcflms', label: () => 'MINT-RNMCFLMS' },
  { key: 'oracle', label: () => 'MINT-Reference' },
];

const REGULARIZATIONS = {
  reg005: { label: 'λ = 0.05', thchsKey: 'reg0p05' },
  reg01: { label: 'λ = 0.1', thchsKey: 'reg0p1', twoMeterSpecsub: '2m/reg0p1', twoMeterNoisy: '2m/no_ss_reg0p1' },
  reg02: {
    label: 'λ = 0.2',
    thchsKey: 'reg0p2',
    repeatRoots: {
      noisy: 'floor4_real_recording_repeat_table_L2048_rho01_1m_2m_samples11_12_noisy_snr5_10_no_ss_reg0p2_repeats_1_20_rmsraw',
      specsub: 'floor4_real_recording_repeat_table_L2048_rho01_1m_2m_samples11_12_noisy_snr5_10_ss_frontend_reg0p2_repeats_1_20_rmsraw',
    },
  },
  noreg: { label: 'λ = 0' },
};

const CONDITIONS = {
  snr5: { label: 'SNR 5 dB', supportedCorpora: ['thchs', 'timit'], maxRepeat: 20 },
  snr10: { label: 'SNR 10 dB', supportedCorpora: ['thchs', 'timit'], maxRepeat: 20 },
  clean: { label: 'noise-free', supportedCorpora: ['thchs', 'timit'], maxRepeat: 20, cleanRoot: 'clean_reg0.1' },
};

const DISTANCES = {
  '1m': { label: '1 m' },
  '2m': { label: '2 m' },
};

const CORPORA = {
  thchs: {
    label: 'THCHS',
    supportedInputs: ['noisy', 'specsub'],
    sections: [
      { sample: 'Sample 1', sampleId: 'sample_11', sampleDir: 'sample11', rawId: '11' },
      { sample: 'Sample 2', sampleId: 'sample_12', sampleDir: 'sample12', rawId: '12' },
      { sample: 'Sample 9', sampleId: 'sample_9', sampleDir: 'sample9', rawId: '9', table: 'samples9_10' },
      { sample: 'Sample 10', sampleId: 'sample_10', sampleDir: 'sample10', rawId: '10', table: 'samples9_10' },
    ],
    baselines: (section, regKey, condition, inputKey, repeat, distance) => {
      const reg = REGULARIZATIONS[regKey];
      if (section.table === 'samples9_10') {
        const repeatRoot = thchsSampleRoot(section, regKey, condition, inputKey, repeat, distance);
        if (CONDITIONS[condition].cleanRoot) {
          const baselineRoot = thchsBaselineRoot(section, regKey, condition, repeat, distance);
          return {
            clean: `${repeatRoot}/raw_clean_mics.wav`,
            wpe: `${baselineRoot}/raw_WPE.wav`,
            gwpe: `${baselineRoot}/raw_GWPE_K50_d2_i2.wav`,
          };
        }

        const baselineRoot = inputKey === 'specsub'
          ? repeatRoot
          : thchsBaselineRoot(section, regKey, condition, repeat, distance);
        return {
          clean: `${repeatRoot}/${inputKey === 'specsub' ? 'raw_specsub_mics.wav' : 'raw_noisy_mics.wav'}`,
          wpe: `${baselineRoot}/${inputKey === 'specsub' ? 'raw_SpecSub_WPE.wav' : 'raw_WPE.wav'}`,
          gwpe: `${baselineRoot}/${inputKey === 'specsub' ? 'raw_SpecSub_GWPE_K50_d2_i2.wav' : 'raw_GWPE_K50_d2_i2.wav'}`,
        };
      }

      if (reg.repeatRoots && !CONDITIONS[condition].cleanRoot) {
        const repeatRoot = `${reg.repeatRoots[inputKey]}/${distance}/${reg.thchsKey}/thchs/${section.sampleId}/deg90/${condition}/repeats_${repeat}`;
        return {
          clean: `${repeatRoot}/${inputKey === 'specsub' ? 'raw_specsub_mics.wav' : 'raw_noisy_mics.wav'}`,
          wpe: inputKey === 'specsub'
            ? `${repeatRoot}/raw_SpecSub_WPE.wav`
            : `floor4_repeat_audio/wpe_gwpe/thchs/${section.sampleId}/deg90/${condition}/raw_WPE.wav`,
          gwpe: inputKey === 'specsub'
            ? `${repeatRoot}/raw_SpecSub_GWPE_K50_d2_i2.wav`
            : `floor4_repeat_audio/wpe_gwpe/thchs/${section.sampleId}/deg90/${condition}/raw_GWPE_K50_d2_i2.wav`,
        };
      }

      if (distance === '2m') {
        if (CONDITIONS[condition].cleanRoot) {
          return {
            clean: `2m/fixed clean/${section.sampleId}/deg90/clean/raw_clean_mics.wav`,
            wpe: `2m/fixed clean/${section.sampleId}/deg90/clean/raw_WPE.wav`,
            gwpe: `2m/fixed clean/${section.sampleId}/deg90/clean/raw_GWPE_K50_d2_i2.wav`,
          };
        }

        const repeatRoot = inputKey === 'specsub'
          ? `${REGULARIZATIONS[regKey].twoMeterSpecsub}/thchs/${section.sampleId}/deg90/${condition}/repeats_${repeat}`
          : `${REGULARIZATIONS[regKey].twoMeterNoisy}/thchs/${section.sampleId}/deg90/${condition}/repeats_${repeat}`;
        return {
          clean: `${repeatRoot}/${inputKey === 'specsub' ? 'raw_specsub_mics.wav' : 'raw_noisy_mics.wav'}`,
          wpe: `${repeatRoot}/${inputKey === 'specsub' ? 'raw_SpecSub_WPE.wav' : 'raw_WPE.wav'}`,
          gwpe: `${repeatRoot}/${inputKey === 'specsub' ? 'raw_SpecSub_GWPE_K50_d2_i2.wav' : 'raw_GWPE_K50_d2_i2.wav'}`,
        };
      }

      if (CONDITIONS[condition].cleanRoot) {
        return {
          clean: `floor4_s11_s12/raw_${section.rawId}.wav`,
          wpe: `floor4_s11_s12/raw${section.rawId}_WPE.wav`,
          gwpe: `floor4_s11_s12/raw${section.rawId}_GWPE_K50_d2_i2.wav`,
        };
      }

      if (inputKey === 'specsub') {
        const repeatRoot = `floor4_repeat_audio_spectral-subtraction/${REGULARIZATIONS[regKey].thchsKey}/thchs/${section.sampleId}/deg90/${condition}/repeats_${repeat}`;
        return {
          clean: `${repeatRoot}/raw_specsub_mics.wav`,
          wpe: `${repeatRoot}/raw_SpecSub_WPE.wav`,
          gwpe: `${repeatRoot}/raw_SpecSub_GWPE_K50_d2_i2.wav`,
        };
      }

      const noisyRoot = regKey === 'reg01'
        ? `floor4_repeat_audio/reg01_sample${section.rawId}/${section.rawId === '11' ? 'deg90/' : ''}${condition}/${section.rawId === '11' ? 'repeats' : 'repeat'}_${repeat}`
        : `floor4_repeat_audio/${regKey}/${condition}/repeat_${repeat}`;
      const wpeRoot = `floor4_repeat_audio/wpe_gwpe/thchs/${section.sampleId}/deg90/${condition}`;
      return {
        clean: `${noisyRoot}/raw_noisy_mics.wav`,
        wpe: `${wpeRoot}/raw_WPE.wav`,
        gwpe: `${wpeRoot}/raw_GWPE_K50_d2_i2.wav`,
      };
    },
    audioPath: (section, regKey, condition, repeat, methodKey, inputKey, distance) => {
      const file = INPUTS[inputKey].files[methodKey];
      const reg = REGULARIZATIONS[regKey];
      if (section.table === 'samples9_10') {
        return `${thchsSampleRoot(section, regKey, condition, inputKey, repeat, distance)}/${file}`;
      }

      if (reg.repeatRoots && !CONDITIONS[condition].cleanRoot) {
        return `${reg.repeatRoots[inputKey]}/${distance}/${reg.thchsKey}/thchs/${section.sampleId}/deg90/${condition}/repeats_${repeat}/${file}`;
      }

      if (distance === '2m') {
        if (CONDITIONS[condition].cleanRoot) {
          const cleanRoots = {
            reg01: 'clean_0.1/2m',
            reg02: 'floor4_real_recording_repeat_table_rho01_reg0p2_deg90_thchs_clean_1m_2m_L2048_repeats_1_20_rmsraw/2m',
            noreg: 'floor4_real_recording_repeat_table_rho01_reg0_deg90_thchs_clean_1m_2m_L2048_repeats_1_20_rmsraw/2m',
          };
          const cleanFile = file.replace('noisy', 'clean');
          return `${cleanRoots[regKey]}/L2048/repeat_${repeat}/thchs/${section.sampleId}/deg90/clean/repeats_${repeat}/${cleanFile}`;
        }

        const root = inputKey === 'specsub'
          ? REGULARIZATIONS[regKey].twoMeterSpecsub
          : REGULARIZATIONS[regKey].twoMeterNoisy;
        return `${root}/thchs/${section.sampleId}/deg90/${condition}/repeats_${repeat}/${file}`;
      }

      if (CONDITIONS[condition].cleanRoot) {
        const cleanRoots = {
          reg005: CONDITIONS[condition].cleanRoot,
          reg01: 'clean_reg0.1',
          reg02: `floor4_real_recording_repeat_table_rho01_reg0p2_deg90_thchs_clean_1m_2m_L2048_repeats_1_20_rmsraw/${distance}`,
          noreg: `floor4_real_recording_repeat_table_rho01_reg0_deg90_thchs_clean_1m_2m_L2048_repeats_1_20_rmsraw/${distance}`,
        };
        const cleanFile = file.replace('noisy', 'clean');
        return `${cleanRoots[regKey]}/L2048/repeat_${repeat}/thchs/${section.sampleId}/deg90/clean/repeats_${repeat}/${cleanFile}`;
      }

      if (inputKey === 'specsub') {
        return `floor4_repeat_audio_spectral-subtraction/${REGULARIZATIONS[regKey].thchsKey}/thchs/${section.sampleId}/deg90/${condition}/repeats_${repeat}/${file}`;
      }

      if (regKey === 'reg01') {
        return `floor4_repeat_audio/reg01_sample${section.rawId}/${section.rawId === '11' ? 'deg90/' : ''}${condition}/${section.rawId === '11' ? 'repeats' : 'repeat'}_${repeat}/${file}`;
      }

      return `floor4_repeat_audio/${regKey}/${condition}/repeat_${repeat}/${file}`;
    },
  },
  timit: {
    label: 'TIMIT',
    supportedInputs: ['noisy', 'specsub'],
    sections: [
      { sample: 'Sample 2', sampleId: 'sample_2', sampleDir: 'sample_2', rawId: '2' },
      { sample: 'Sample 4', sampleId: 'sample_4', sampleDir: 'sample_4', rawId: '4' },
      { sample: 'Sample 6', sampleId: 'sample_6', sampleDir: 'sample_6', rawId: '6' },
      { sample: 'Sample 8', sampleId: 'sample_8', sampleDir: 'sample_8', rawId: '8' },
    ],
    baselines: (section, regKey, condition, inputKey, repeat, distance) => {
      const repeatRoot = timitSampleRoot(section, regKey, condition, inputKey, repeat, distance);
      if (CONDITIONS[condition].cleanRoot) {
        const baselineRoot = timitBaselineRoot(section, regKey, condition, repeat, distance);
        return {
          clean: `${repeatRoot}/raw_clean_mics.wav`,
          wpe: `${baselineRoot}/raw_WPE.wav`,
          gwpe: `${baselineRoot}/raw_GWPE_K50_d2_i2.wav`,
        };
      }

      const baselineRoot = inputKey === 'specsub'
        ? repeatRoot
        : timitBaselineRoot(section, regKey, condition, repeat, distance);
      return {
        clean: `${repeatRoot}/${inputKey === 'specsub' ? 'raw_specsub_mics.wav' : 'raw_noisy_mics.wav'}`,
        wpe: `${baselineRoot}/${inputKey === 'specsub' ? 'raw_SpecSub_WPE.wav' : 'raw_WPE.wav'}`,
        gwpe: `${baselineRoot}/${inputKey === 'specsub' ? 'raw_SpecSub_GWPE_K50_d2_i2.wav' : 'raw_GWPE_K50_d2_i2.wav'}`,
      };
    },
    audioPath: (section, regKey, condition, repeat, methodKey, inputKey, distance) => {
      const file = INPUTS[inputKey].files[methodKey];
      return `${timitSampleRoot(section, regKey, condition, inputKey, repeat, distance)}/${file}`;
    },
  },
};

function regDirectory(regKey) {
  return regKey === 'noreg' ? 'reg0p0' : REGULARIZATIONS[regKey].thchsKey;
}

function thchsSampleRoot(section, regKey, condition, inputKey, repeat, distance) {
  if (CONDITIONS[condition].cleanRoot) {
    const cleanRoots = {
      reg01: 'floor4_real_recording_repeat_table_rho01_reg0p1_deg90_thchs_clean_1m_2m_L2048_samples9_10_repeats_1_20_rmsraw',
      reg02: 'floor4_real_recording_repeat_table_rho01_reg0p2_deg90_thchs_clean_1m_2m_L2048_samples9_10_repeats_1_20_rmsraw',
      noreg: 'floor4_real_recording_repeat_table_rho01_reg0_deg90_thchs_clean_1m_2m_L2048_samples9_10_repeats_1_20_rmsraw',
    };
    return `${cleanRoots[regKey]}/${distance}/L2048/repeat_${repeat}/thchs/${section.sampleId}/deg90/clean/repeats_${repeat}`;
  }

  const roots = {
    reg01: {
      noisy: 'floor4_real_recording_repeat_table_L2048_rho01_1m_2m_samples9_10_noisy_snr5_10_no_ss_reg0p1_repeats_1_20_rmsraw',
      specsub: 'floor4_real_recording_repeat_table_L2048_rho01_1m_2m_samples9_10_noisy_snr5_10_ss_frontend_reg0p1_repeats_1_20_rmsraw',
    },
    reg02: {
      noisy: 'floor4_real_recording_repeat_table_L2048_rho01_1m_2m_samples9_10_noisy_snr5_10_no_ss_reg0p2_repeats_1_20_rmsraw',
      specsub: 'floor4_real_recording_repeat_table_L2048_rho01_1m_2m_samples9_10_noisy_snr5_10_ss_frontend_reg0p2_repeats_1_20_rmsraw',
    },
  };
  return `${roots[regKey][inputKey]}/${distance}/${REGULARIZATIONS[regKey].thchsKey}/thchs/${section.sampleId}/deg90/${condition}/repeats_${repeat}`;
}

function thchsBaselineRoot(section, regKey, condition, repeat, distance) {
  if (CONDITIONS[condition].cleanRoot) {
    return `floor4_missing_WPE_GWPE_TIMIT2468_sample9_10/THCHS_sample9_10/clean/${distance}/L2048/repeat_${repeat}/thchs/${section.sampleId}/deg90/clean/repeats_${repeat}`;
  }

  return `floor4_missing_WPE_GWPE_TIMIT2468_sample9_10/THCHS_sample9_10/noSS/${distance}/${REGULARIZATIONS[regKey].thchsKey}/thchs/${section.sampleId}/deg90/${condition}/repeats_${repeat}`;
}

function timitSampleRoot(section, regKey, condition, inputKey, repeat, distance) {
  if (CONDITIONS[condition].cleanRoot) {
    return `floor4_real_recording_repeat_table_L2048_rho01_timit_${distance}_clean_reg0_reg0p1_reg0p2_repeats_1_20_raw_only/${distance}/${regDirectory(regKey)}/timit/${section.sampleId}/deg90/clean/repeats_${repeat}`;
  }

  const inputPart = inputKey === 'specsub' ? 'ss_frontend' : 'no_ss';
  return `floor4_real_recording_repeat_table_L2048_rho01_timit_${distance}_noisy_snr5_10_${inputPart}_reg0p1_reg0p2_repeats_1_20_raw_only/${distance}/${REGULARIZATIONS[regKey].thchsKey}/timit/${section.sampleId}/deg90/${condition}/repeats_${repeat}`;
}

function timitBaselineRoot(section, regKey, condition, repeat, distance) {
  const conditionPart = CONDITIONS[condition].cleanRoot ? 'clean' : 'noSS';
  const regPart = CONDITIONS[condition].cleanRoot ? regDirectory(regKey) : REGULARIZATIONS[regKey].thchsKey;
  const conditionPath = CONDITIONS[condition].cleanRoot ? 'clean' : condition;
  return `floor4_missing_WPE_GWPE_TIMIT2468_sample9_10/TIMIT2468/${conditionPart}/${distance}/${regPart}/timit/${section.sampleId}/deg90/${conditionPath}/repeats_${repeat}`;
}

const state = {
  repeat: 1,
  distance: '1m',
  snr: 'snr5',
  corpus: 'thchs',
  lambda: 'reg005',
  input: 'noisy',
};

const els = {
  repeatFilter: document.querySelector('#repeat-filter'),
  distanceFilter: document.querySelector('#distance-filter'),
  snrFilter: document.querySelector('#snr-filter'),
  corpusFilter: document.querySelector('#corpus-filter'),
  lambdaFilter: document.querySelector('#lambda-filter'),
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

function updateCorpusAvailability() {
  for (const option of els.corpusFilter.options) {
    option.hidden = false;
    option.disabled = false;
  }

  els.corpusFilter.value = state.corpus;
}

function updateConditionAvailability() {
  for (const option of els.snrFilter.options) {
    const isSupported = CONDITIONS[option.value].supportedCorpora.includes(state.corpus);
    option.hidden = !isSupported;
    option.disabled = !isSupported;
  }

  if (!CONDITIONS[state.snr].supportedCorpora.includes(state.corpus)) {
    state.snr = 'snr5';
  }

  if (state.repeat > CONDITIONS[state.snr].maxRepeat) {
    state.repeat = CONDITIONS[state.snr].maxRepeat;
  }

  for (const option of els.repeatFilter.options) {
    const isSupported = Number(option.value) <= CONDITIONS[state.snr].maxRepeat;
    option.hidden = !isSupported;
    option.disabled = !isSupported;
  }

  els.snrFilter.value = state.snr;
  els.repeatFilter.value = String(state.repeat);
}

function updateInputAvailability() {
  const corpus = selectedCorpus();
  const supportedInputs = CONDITIONS[state.snr].cleanRoot
    ? ['noisy']
    : corpus.supportedInputs;

  for (const option of els.inputFilter.options) {
    const isSupported = supportedInputs.includes(option.value);
    option.hidden = !isSupported;
    option.disabled = !isSupported;
  }

  if (!supportedInputs.includes(state.input)) {
    state.input = supportedInputs[0];
  }

  els.inputFilter.value = state.input;
  els.inputFilter.disabled = supportedInputs.length === 1;
}

function supportedLambdaKeys() {
  if (CONDITIONS[state.snr].cleanRoot) {
    return ['reg01', 'reg02', 'noreg'];
  }

  return ['reg01', 'reg02'];
}

function updateLambdaAvailability() {
  const supportedLambdas = supportedLambdaKeys();

  for (const option of els.lambdaFilter.options) {
    const isSupported = supportedLambdas.includes(option.value);
    option.hidden = !isSupported;
    option.disabled = !isSupported;
  }

  if (!supportedLambdas.includes(state.lambda)) {
    state.lambda = supportedLambdas[0];
  }

  els.lambdaFilter.value = state.lambda;
}

function audioPath(section, regKey, snr, repeat, methodKey) {
  return selectedCorpus().audioPath(section, regKey, snr, repeat, methodKey, state.input, state.distance);
}

function makeAudio(src) {
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.preload = 'none';
  audio.src = encodeURI(src);
  return audio;
}

function baselineLabels() {
  if (CONDITIONS[state.snr].cleanRoot) {
    return ['Clean', 'WPE', 'GWPE'];
  }

  if (state.input === 'specsub') {
    return ['Spectral-Subtraction', 'WPE', 'GWPE'];
  }

  return ['Noisy', 'WPE', 'GWPE'];
}

function renderBaselineCards(section, regKey) {
  const baseline = selectedCorpus().baselines(section, regKey, state.snr, state.input, state.repeat, state.distance);
  const [inputLabel, wpeLabel, gwpeLabel] = baselineLabels();
  const cards = [
    [inputLabel, baseline.clean],
    [wpeLabel, baseline.wpe],
    [gwpeLabel, baseline.gwpe],
  ];

  return cards.filter(([, src]) => src).map(([label, src]) => {
    const row = document.createElement('article');
    row.className = 'audio-row repeat-audio-row';
    row.innerHTML = `
      <div class="audio-meta">
        <h5>${label}</h5>
        <div class="badges">
          <span class="badge muted">${section.sample}</span>
          <span class="badge muted">${REGULARIZATIONS[regKey].label}</span>
        </div>
      </div>
    `;
    row.append(makeAudio(src));
    return row;
  });
}

function renderMethodCard(section, regKey, method) {
  const input = INPUTS[state.input];
  const condition = CONDITIONS[state.snr];
  const row = document.createElement('article');
  row.className = 'audio-row repeat-audio-row';
  row.innerHTML = `
    <div class="audio-meta">
      <h5>${method.label(input)}</h5>
      <div class="badges">
        <span class="badge">Repeat ${state.repeat}</span>
        <span class="badge muted">${condition.label}</span>
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

  group.append(baselineGroup);

  const methodGroup = document.createElement('div');
  methodGroup.className = 'repeat-subsection';
  methodGroup.innerHTML = `<h3>${REGULARIZATIONS[regKey].label} · Selected repeat outputs</h3>`;
  const methodGrid = document.createElement('div');
  methodGrid.className = 'repeat-grid';
  methodGrid.append(...METHODS.map(method => renderMethodCard(section, regKey, method)));
  methodGroup.append(methodGrid);
  group.append(methodGroup);

  return group;
}

function activeRegKeys(section) {
  return [state.lambda];
}

function render() {
  updateCorpusAvailability();
  updateConditionAvailability();
  updateLambdaAvailability();
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

    section.append(...activeRegKeys(sectionConfig).map(regKey => renderRegGroup(sectionConfig, regKey)));
    els.content.append(section);
  }

  els.status.textContent = `Showing ${DISTANCES[state.distance].label}, ${corpus.label}, repeat ${state.repeat}, ${CONDITIONS[state.snr].label}, ${REGULARIZATIONS[state.lambda].label}, ${INPUTS[state.input].label} input.`;
}

function init() {
  for (const repeat of REPEATS) {
    els.repeatFilter.append(makeOption(String(repeat), `Repeat ${repeat}`));
  }

  els.repeatFilter.value = String(state.repeat);
  els.distanceFilter.value = state.distance;
  els.snrFilter.value = state.snr;
  els.corpusFilter.value = state.corpus;
  els.lambdaFilter.value = state.lambda;
  els.inputFilter.value = state.input;

  els.repeatFilter.addEventListener('change', () => {
    state.repeat = Number(els.repeatFilter.value);
    if (state.repeat > CONDITIONS[state.snr].maxRepeat) {
      state.repeat = CONDITIONS[state.snr].maxRepeat;
    }
    render();
  });

  els.distanceFilter.addEventListener('change', () => {
    state.distance = els.distanceFilter.value;
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

  els.lambdaFilter.addEventListener('change', () => {
    state.lambda = els.lambdaFilter.value;
    render();
  });

  els.inputFilter.addEventListener('change', () => {
    state.input = els.inputFilter.value;
    render();
  });

  render();
}

init();

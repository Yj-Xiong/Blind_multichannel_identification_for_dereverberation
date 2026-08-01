const ROOT = 'specsub_raw_audio_20samples_snr30_20_10_5_repeat30_lambda0p2_rho0p1';
const SAMPLES = [
  'FJEM0_SI634',
  'MJJG0_SI1003',
  'MPAB0_SI1103',
  'mandarin__SSB10200196',
  'mandarin__SSB10200425',
  'mandarin__SSB10240175',
];
const SNRS = [20, 10, 5];
const METHODS = [
  { key: 'noisy_observation', file: 'raw_noisy_observation.wav' },
  { key: 'wpe', file: 'raw_WPE_SS.wav' },
  { key: 'gwpe', file: 'raw_GWPE_SS.wav' },
  { key: 'mint_n', file: 'raw_BCI_NMCFLMS_SS.wav' },
  { key: 'mint_r', file: 'raw_BCI_RNMCFLMS_SS.wav' },
  { key: 'mint_lp', file: 'raw_BCI_Lp_p1p0_SS.wav' },
  { key: 'mint_elp', file: 'raw_BCI_ELp_p1p0_SS.wav' },
  { key: 'mint_ref', file: 'raw_Reference_MINT_SS.wav' },
  { key: 'scaled_ref', reference: true },
];
const TRIALS = SAMPLES.flatMap(sample => SNRS.map(snr => ({ sample, snr, lambda: '0.2', rho: '0.1', repeats: 30 })));

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mpqgvpvo';
const STORAGE_KEY = 'nc2026-specsub-raw-mushra-listener-rho0p1-v1';

const TEXT = {
  en: {
    eyebrow: 'MUSHRA listening evaluation',
    title: 'MUSHRA Evaluation',
    introTitle: 'Introduction',
    introSubtitle: '',
    introContextTitle: 'Introduction',
    introContext: [
      'This evaluation compares the listening quality of different speech dereverberation methods.',
      'The test set contains 3 clean English utterances and 3 clean Mandarin utterances from the TIMIT and AISHELL-3 datasets.',
      'The reverberant noisy speech signals were simulated by convolution and by adding incoherent white background noise. In each trial, please compare the different processed versions of the same utterance and judge which ones sound less reverberant, clearer, and more natural.',
    ],
    introCriteriaTitle: 'Scoring focus',
    introCriteria: [
      'Primary criterion: reverberation reduction. Stronger reverberation often makes speech sound farther away, more room-like or spacious, with a longer tail after each sound; this should generally lower the score. Weaker reverberation usually sounds closer, cleaner, and more direct.',
      'Speech quality and clarity: prefer samples where the speech is natural, clear, and easy to understand. Penalize obvious muffling, metallic artifacts, broken speech, or distortion caused by over-processing.',
      'Secondary cues: when samples are similar in reverberation, quality, and clarity, use residual noise or other minor artifacts only as secondary references.',
    ],
    introNote: 'Please use headphones in a quiet environment if possible, and keep the same scoring standard across all trials.',
    guidanceTitle: 'Scoring criteria reference',
    guidanceNote: 'Please assign a full score of 100 to at least one sample in each trial.',
    selectLanguage: 'Select Language',
    english: 'English',
    chinese: 'Chinese',
    reset: 'Reset scores in this trial',
    previous: 'Previous',
    next: 'Next',
    review: 'Review submission',
    startEvaluation: 'Start evaluation',
    trial: 'Trial',
    rated: 'rated',
    unrated: 'Unrated',
    scorePlaceholder: 'Enter the score',
    navIncomplete: 'Please complete all ratings in this trial before continuing.',
    submitIncomplete: 'Submission failed. Please complete all trial ratings before submitting.',
    submitting: 'Submitting...',
    submitSuccess: 'Submitted successfully. Thank you!',
    submitError: 'Submission failed. A backup JSON file has been downloaded; please send it to the organizers.',
    submissionTitle: 'MUSHRA result submission',
    listenerId: 'ID / name',
    listenerPlaceholder: 'e.g. L01',
    sessionNote: 'Session note',
    sessionPlaceholder: 'optional: headphone, room, date...',
    gender: 'Gender',
    genderPlaceholder: 'Select gender',
    genderFemale: 'Female',
    genderMale: 'Male',
    genderOther: 'Other / prefer not to say',
    expertise: 'Listener background',
    expertisePlaceholder: 'Select your background',
    expertiseGeneral: 'General listener (no prior experience)',
    expertiseIntermediate: 'Somewhat experienced (listening-test experience or audio knowledge)',
    expertiseExpert: 'Highly experienced (extensive experience or job-related background)',
    submit: 'Submit',
    footer: 'MUSHRA scores are stored only in this browser until submitted.',
    utterance: 'Utterance',
    sampleLabel: 'Sample',
    referenceTitle: 'Reference audio for this trial',
    referenceNote: 'Listen to this trial reference audio first as an auditory anchor. The rating samples remain anonymized and may include a hidden copy of this reference.',
    scale: ['Bad', 'Poor', 'Fair', 'Good', 'Excellent'],
  },
  zh: {
    eyebrow: 'MUSHRA 听音评价',
    title: 'MUSHRA 评价',
    introTitle: '导言',
    introSubtitle: '',
    introContextTitle: '导言',
    introContext: [
      '本页面用于评价不同语音降混响处理结果的主观听感质量。',
      '本次评测中，测试语料源自 TIMIT 数据集和 AISHELL-3 数据集，分别选取 3 条干净英文语音和 3 条干净普通话语音。',
      '具有不同带噪条件的混响语音是通过卷积和添加不相干的白背景噪声仿真产生的。在每个轮次中，你将听到同一句混响语音经过不同方法处理后的多个版本。请在同一轮次内对这些样本进行比较，并根据整体听感质量为每个样本打分。混响越少、语音越清晰自然，分数应越高。',
    ],
    introCriteriaTitle: '评分重点',
    introCriteria: [
      '首要标准：混响降低效果。混响较强时，语音通常显得更远、更空旷，空间感或包围感更明显，字音后面可能带有拖尾；这类情况通常应降低评分。混响较弱时，语音通常更靠前、更干净、更直接。',
      '语音质量与清晰度：优先选择语音自然、清晰、容易听懂的样本；如果出现发闷、金属感、破碎感或过度处理导致的明显失真，应相应降低评分。',
      '次要参考：当样本在混响、质量和清晰度方面接近时，再把噪声残留或其他轻微伪影作为辅助判断依据。',
    ],
    introNote: '',
    guidanceTitle: '评分标准参考',
    guidanceNote: '建议使用耳机，在安静环境中完成评测；请保持同一套判断标准完成所有轮次。每一轮打分时，请至少选择一个样本给出满分 100 分。',
    selectLanguage: '选择语言',
    english: '英文',
    chinese: '中文',
    reset: '重置本轮评分',
    previous: '上一页',
    next: '下一页',
    review: '跳转提交入口',
    startEvaluation: '开始评测',
    trial: '轮次',
    rated: '已评分',
    utterance: '语料',
    sampleLabel: '样本',
    unrated: '未评分',
    scorePlaceholder: '输入分数',
    navIncomplete: '请完成当前轮次的所有评分后再继续。',
    submitIncomplete: '提交失败，请完成所有轮次评分后再提交。',
    submitting: '提交中...',
    submitSuccess: '提交成功，谢谢！',
    submitError: '提交失败。已下载备份 JSON 文件，请将其发送给组织者。',
    submissionTitle: 'MUSHRA 结果提交',
    listenerId: 'ID / 姓名',
    listenerPlaceholder: '例如 L01',
    sessionNote: '测试备注',
    sessionPlaceholder: '可选：耳机、环境、日期等',
    gender: '性别',
    genderPlaceholder: '请选择性别',
    genderFemale: '女',
    genderMale: '男',
    genderOther: '其他 / 不愿透露',
    expertise: '听评经验',
    expertisePlaceholder: '请选择听评经验',
    expertiseGeneral: '无相关经验',
    expertiseIntermediate: '有一定听评或音频知识',
    expertiseExpert: '经验丰富或职业相关',
    submit: '提交',
    footer: 'MUSHRA 分数在提交前仅保存在当前浏览器中。',
    referenceTitle: '本轮参考音频',
    referenceNote: '请先播放本轮参考音频作为听觉参照；下方待评分样本保持匿名，并可能包含该参考的隐藏副本。',
    scale: [
      '质量很差，混响或失真严重，语音较难听清',
      '质量较差，仍有明显混响、拖尾或处理失真',
      '质量一般，语音基本可懂，但混响或失真仍可察觉',
      '质量良好，语音较清晰自然，仅有轻微混响或失真',
      '质量优秀，语音清晰自然，混响和失真很少；噪声残留也较少',
    ],
  },
};

const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
const state = {
  scores: saved.scores || {},
  methodOrders: saved.methodOrders || {},
  listenerId: saved.listenerId || '',
  sessionNote: saved.sessionNote || '',
  gender: saved.gender || '',
  expertise: saved.expertise || '',
  trialIndex: Math.max(0, Math.min(TRIALS.length - 1, saved.trialIndex || 0)),
  language: saved.language || 'zh',
};

const els = {
  content: document.querySelector('#mushra-content'),
  progress: document.querySelector('#mushra-progress'),
  reset: document.querySelector('#mushra-reset'),
  language: document.querySelector('#mushra-language'),
  previous: document.querySelector('#mushra-prev'),
  next: document.querySelector('#mushra-next'),
  start: document.querySelector('#mushra-start'),
  navStatus: document.querySelector('#mushra-nav-status'),
  listenerId: document.querySelector('#mushra-listener-id'),
  sessionNote: document.querySelector('#mushra-session-note'),
  gender: document.querySelector('#mushra-gender'),
  expertise: document.querySelector('#mushra-expertise'),
  submit: document.querySelector('#mushra-submit'),
  submitStatus: document.querySelector('#mushra-submit-status'),
  submission: document.querySelector('#mushra-submission'),
};

function tr(key) {
  return TEXT[state.language || 'en'][key];
}

function applyLanguage() {
  const activeLanguage = state.language || 'en';
  const text = TEXT[activeLanguage];
  document.documentElement.lang = activeLanguage === 'zh' ? 'zh-CN' : 'en';
  document.querySelector('#mushra-eyebrow').textContent = text.eyebrow;
  document.querySelector('#mushra-title').textContent = text.title;
  document.querySelector('#mushra-intro-title').textContent = text.introTitle;
  document.querySelector('#mushra-intro-subtitle').textContent = text.introSubtitle;
  document.querySelector('#mushra-intro-context-title').textContent = text.introContextTitle;
  document.querySelector('#mushra-intro-context').innerHTML = text.introContext.map(item => `<li>${item}</li>`).join('');
  document.querySelector('#mushra-intro-criteria-title').textContent = text.introCriteriaTitle;
  document.querySelector('#mushra-intro-criteria').innerHTML = text.introCriteria.map(item => `<li>${item}</li>`).join('');
  document.querySelector('#mushra-intro-note').textContent = text.introNote;
  document.querySelector('#mushra-guidance-title').textContent = text.guidanceTitle;
  document.querySelector('#mushra-guidance-note').textContent = text.guidanceNote;
  els.language.options[0].textContent = text.selectLanguage;
  els.language.options[1].textContent = text.english;
  els.language.options[2].textContent = text.chinese;
  els.reset.textContent = text.reset;
  els.previous.textContent = text.previous;
  els.start.textContent = text.startEvaluation;
  document.querySelector('#mushra-submission-title').textContent = text.submissionTitle;
  document.querySelector('#mushra-listener-id-label').textContent = text.listenerId;
  document.querySelector('#mushra-session-note-label').textContent = text.sessionNote;
  document.querySelector('#mushra-gender-label').textContent = text.gender;
  document.querySelector('#mushra-expertise-label').textContent = text.expertise;
  els.listenerId.placeholder = text.listenerPlaceholder;
  els.sessionNote.placeholder = text.sessionPlaceholder;
  els.gender.options[0].textContent = text.genderPlaceholder;
  els.gender.options[1].textContent = text.genderFemale;
  els.gender.options[2].textContent = text.genderMale;
  els.gender.options[3].textContent = text.genderOther;
  els.expertise.options[0].textContent = text.expertisePlaceholder;
  els.expertise.options[1].textContent = text.expertiseGeneral;
  els.expertise.options[2].textContent = text.expertiseIntermediate;
  els.expertise.options[3].textContent = text.expertiseExpert;
  els.submit.textContent = text.submit;
  document.querySelector('footer p').textContent = text.footer;
  for (let i = 0; i < text.scale.length; i += 1) {
    document.querySelector(`#mushra-scale-${i + 1}-desc`).textContent = text.scale[i];
  }
  updateProgress();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    listenerId: state.listenerId,
    sessionNote: state.sessionNote,
    gender: state.gender,
    expertise: state.expertise,
    trialIndex: state.trialIndex,
    language: state.language,
    methodOrders: state.methodOrders,
    scores: state.scores,
  }));
}

function entryId(trial, method) {
  return `${trial.sample}-${trial.snr}-${method.key}`.replace(/[^a-zA-Z0-9]+/g, '_');
}

function audioPath(trial, method) {
  if (method.reference) {
    const samplePath = trial.sample.startsWith('mandarin__')
      ? `mandarin/${trial.sample.replace('mandarin__', '')}`
      : trial.sample;
    return `ref_wavs_scaled/snr${trial.snr}/${samplePath}.wav`;
  }
  return `${ROOT}/${trial.sample}/snr${trial.snr}/${method.file}`;
}

function makeAudio(src) {
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.preload = 'none';
  audio.src = encodeURI(src);
  return audio;
}

function setScore(id, score, output, card, slider, scoreInput) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return;
  const normalizedScore = Math.max(0, Math.min(100, Math.round(numericScore)));
  state.scores[id] = normalizedScore;
  if (output) output.textContent = normalizedScore.toFixed(0);
  if (slider) slider.value = normalizedScore;
  if (scoreInput) scoreInput.value = normalizedScore;
  card.classList.remove('unrated');
  card.classList.add('rated');
  saveState();
  updateProgress();
}

function shuffle(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function methodOrderKey(trial) {
  return `${trial.sample}-${trial.snr}`.replace(/[^a-zA-Z0-9]+/g, '_');
}

function methodOrder(trial) {
  const key = methodOrderKey(trial);
  if (!Array.isArray(state.methodOrders[key]) || state.methodOrders[key].length !== METHODS.length) {
    state.methodOrders[key] = shuffle(METHODS.map(method => method.key));
    saveState();
  }
  return state.methodOrders[key];
}

function orderedMethods(trial) {
  const order = methodOrder(trial);
  return [...METHODS].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

function anonymousMethodLabel(displayIndex) {
  return `${tr('sampleLabel')} ${displayIndex + 1}`;
}

function renderReference(trial) {
  const panel = document.createElement('div');
  panel.className = 'mushra-reference-panel';
  const text = document.createElement('div');
  text.innerHTML = `<h3>${tr('referenceTitle')}</h3><p>${tr('referenceNote')}</p>`;
  panel.append(text, makeAudio(audioPath(trial, METHODS.find(method => method.reference))));
  return panel;
}

function renderMethod(trial, method, displayIndex) {
  const id = entryId(trial, method);
  const card = document.createElement('article');
  card.className = `mushra-card ${state.scores[id] === undefined ? 'unrated' : 'rated'}`;
  card.dataset.scoreId = id;

  const title = document.createElement('div');
  title.className = 'subjective-card-title';
  title.innerHTML = `<h4>${anonymousMethodLabel(displayIndex)}</h4>`;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '1';
  slider.value = state.scores[id] ?? 50;

  const scoreInput = document.createElement('input');
  scoreInput.type = 'number';
  scoreInput.className = 'mushra-score-input';
  scoreInput.min = '0';
  scoreInput.max = '100';
  scoreInput.step = '1';
  scoreInput.inputMode = 'numeric';
  scoreInput.placeholder = tr('scorePlaceholder');
  scoreInput.value = state.scores[id] ?? '';
  scoreInput.setAttribute('aria-label', `${anonymousMethodLabel(displayIndex)} score`);

  slider.addEventListener('input', () => setScore(id, slider.value, null, card, slider, scoreInput));
  scoreInput.addEventListener('input', () => {
    if (scoreInput.value === '') return;
    setScore(id, scoreInput.value, null, card, slider, scoreInput);
  });
  scoreInput.addEventListener('change', () => {
    if (scoreInput.value === '') return;
    setScore(id, scoreInput.value, null, card, slider, scoreInput);
  });

  const ticks = document.createElement('div');
  ticks.className = 'mushra-ticks';
  ticks.innerHTML = '<span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span>';

  const control = document.createElement('div');
  control.className = 'mushra-control';
  control.append(slider, ticks);

  card.append(title, makeAudio(audioPath(trial, method)), control, scoreInput);
  return card;
}

function trialEntries(trial = TRIALS[state.trialIndex]) {
  return METHODS.map(method => ({ trial, method, id: entryId(trial, method) }));
}

function allEntries() {
  return TRIALS.flatMap(trial => trialEntries(trial));
}

function firstUnratedInTrial(index = state.trialIndex) {
  return trialEntries(TRIALS[index]).find(entry => state.scores[entry.id] === undefined);
}

function firstUnrated() {
  return allEntries().find(entry => state.scores[entry.id] === undefined);
}

function updateProgress() {
  const ratedTotal = allEntries().filter(entry => state.scores[entry.id] !== undefined).length;
  const total = allEntries().length;
  els.progress.textContent = `${tr('trial')} ${state.trialIndex + 1} / ${TRIALS.length}`;
  els.previous.disabled = state.trialIndex === 0;
  els.next.textContent = state.trialIndex === TRIALS.length - 1 ? tr('review') : tr('next');
}

function utteranceLabel(trial) {
  return `${tr('utterance')} ${SAMPLES.indexOf(trial.sample) + 1}`;
}

function render() {
  const trial = TRIALS[state.trialIndex];
  const ratedTotal = allEntries().filter(entry => state.scores[entry.id] !== undefined).length;
  const total = allEntries().length;
  els.content.innerHTML = '';
  els.navStatus.textContent = '';
  els.navStatus.classList.remove('error', 'success');

  const section = document.createElement('section');
  section.className = 'subjective-section';
  section.innerHTML = `
    <div class="subjective-section-heading">
      <div>
        <h2>${utteranceLabel(trial)} · SNR ${trial.snr} dB</h2>
      </div>
      <span class="mushra-rated-progress">${ratedTotal} / ${total} ${tr('rated')}</span>
    </div>
  `;

  section.append(renderReference(trial));

  const grid = document.createElement('div');
  grid.className = 'mushra-grid';
  for (const [index, method] of orderedMethods(trial).entries()) {
    grid.append(renderMethod(trial, method, index));
  }
  section.append(grid);
  els.content.append(section);
  updateProgress();
}

function scrollToUnrated(entry) {
  const card = document.querySelector(`[data-score-id="${entry.id}"]`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('needs-rating');
    setTimeout(() => card.classList.remove('needs-rating'), 1800);
  }
}

function goToTrial(index) {
  state.trialIndex = Math.max(0, Math.min(TRIALS.length - 1, index));
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function buildPayload() {
  const scores = allEntries().map(({ trial, method, id }) => ({
    id,
    method: anonymousMethodLabel(methodOrder(trial).indexOf(method.key)),
    methodKey: method.key,
    utterance: SAMPLES.indexOf(trial.sample) + 1,
    sample: trial.sample,
    snr: trial.snr,
    lambda: trial.lambda,
    rho: trial.rho,
    repeats: trial.repeats,
    audioPath: audioPath(trial, method),
    score: state.scores[id] === undefined ? null : Number(state.scores[id]),
  }));
  return {
    type: 'nc2026-specsub-raw-mushra-scores',
    version: 1,
    exportedAt: new Date().toISOString(),
    listenerId: state.listenerId || 'anonymous',
    sessionNote: state.sessionNote || '',
    gender: state.gender || '',
    expertise: state.expertise || '',
    audioRoot: ROOT,
    scoreScale: [0, 100],
    ratedCount: scores.filter(item => item.score !== null).length,
    totalCount: scores.length,
    scores,
  };
}

function payloadFilename(data) {
  const safeId = data.listenerId.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'anonymous';
  return `nc2026_specsub_raw_mushra_${safeId}.json`;
}

function payloadBlob(data) {
  return new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
}

function downloadPayload(data) {
  const url = URL.createObjectURL(payloadBlob(data));
  const a = document.createElement('a');
  a.href = url;
  a.download = payloadFilename(data);
  a.click();
  URL.revokeObjectURL(url);
}

function buildSubmissionFormData(data) {
  const formData = new FormData();
  formData.append('listenerId', data.listenerId);
  formData.append('sessionNote', data.sessionNote);
  formData.append('gender', data.gender);
  formData.append('expertise', data.expertise);
  formData.append('submittedAt', data.exportedAt);
  formData.append('evaluationType', data.type);
  formData.append('scoreCount', String(data.ratedCount));
  formData.append('totalCount', String(data.totalCount));
  formData.append('scoresJson', JSON.stringify(data.scores));
  formData.append('payloadJson', JSON.stringify(data));
  return formData;
}

async function submit() {
  const missing = firstUnrated();
  if (missing) {
    state.trialIndex = TRIALS.findIndex(trial => trial.sample === missing.trial.sample && trial.snr === missing.trial.snr);
    saveState();
    render();
    els.submitStatus.textContent = tr('submitIncomplete');
    els.submitStatus.classList.remove('success');
    els.submitStatus.classList.add('error');
    scrollToUnrated(missing);
    return;
  }

  const data = buildPayload();
  els.submitStatus.textContent = tr('submitting');
  els.submitStatus.classList.remove('error', 'success');
  els.submit.disabled = true;
  try {
    const response = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: buildSubmissionFormData(data),
    });
    if (!response.ok) throw new Error('Submission failed.');
    els.submitStatus.textContent = tr('submitSuccess');
    els.submitStatus.classList.add('success');
  } catch (error) {
    els.submitStatus.textContent = tr('submitError');
    els.submitStatus.classList.add('error');
    downloadPayload(data);
  } finally {
    els.submit.disabled = false;
  }
}

function init() {
  els.listenerId.value = state.listenerId;
  els.sessionNote.value = state.sessionNote;
  els.gender.value = state.gender;
  els.expertise.value = state.expertise;
  els.language.value = state.language;
  applyLanguage();
  els.language.addEventListener('change', () => {
    state.language = els.language.value;
    saveState();
    applyLanguage();
    render();
  });
  els.listenerId.addEventListener('input', () => { state.listenerId = els.listenerId.value.trim(); saveState(); });
  els.sessionNote.addEventListener('input', () => { state.sessionNote = els.sessionNote.value.trim(); saveState(); });
  els.gender.addEventListener('change', () => { state.gender = els.gender.value; saveState(); });
  els.expertise.addEventListener('change', () => { state.expertise = els.expertise.value; saveState(); });
  els.previous.addEventListener('click', () => goToTrial(state.trialIndex - 1));
  els.start.addEventListener('click', () => {
    document.querySelector('#mushra-content').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  els.next.addEventListener('click', () => {
    const missing = firstUnratedInTrial();
    if (missing) {
      els.navStatus.textContent = tr('navIncomplete');
      els.navStatus.classList.add('error');
      scrollToUnrated(missing);
      return;
    }
    if (state.trialIndex < TRIALS.length - 1) goToTrial(state.trialIndex + 1);
    else {
      els.submission.hidden = false;
      document.querySelector('#mushra-submission').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
  els.reset.addEventListener('click', () => {
    const trial = TRIALS[state.trialIndex];
    trialEntries(trial).forEach(entry => { delete state.scores[entry.id]; });
    delete state.methodOrders[methodOrderKey(trial)];
    saveState();
    render();
  });
  els.submit.addEventListener('click', submit);
  render();
}

init();

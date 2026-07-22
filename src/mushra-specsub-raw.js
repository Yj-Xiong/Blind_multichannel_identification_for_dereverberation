const ROOT = 'specsub_raw_audio_20samples_snr30_20_10_5_repeat30_lambda0p2_rho0p2';
const SAMPLES = [
  'FEDW0_SX364',
  'FJEM0_SI634',
  'FJSA0_SI749',
  'FRAM1_SI522',
  'FRNG0_SI725',
  'MAHH0_SI1294',
  'MGRT0_SI820',
  'MJJG0_SI1003',
  'MPAB0_SI1103',
  'MPLB0_SI764',
  'mandarin__SSB10200120',
  'mandarin__SSB10200196',
  'mandarin__SSB10200412',
  'mandarin__SSB10200425',
  'mandarin__SSB10200462',
  'mandarin__SSB10240175',
  'mandarin__SSB10240193',
  'mandarin__SSB10240222',
  'mandarin__SSB10240347',
  'mandarin__SSB10240375',
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
];
const TRIALS = SAMPLES.flatMap(sample => SNRS.map(snr => ({ sample, snr, lambda: '0.2', rho: '0.2', repeats: 30 })));

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mpqgvpvo';
const STORAGE_KEY = 'nc2026-specsub-raw-mushra-listener-v1';

const TEXT = {
  en: {
    eyebrow: 'MUSHRA listening evaluation',
    title: 'MUSHRA Evaluation',
    guidanceTitle: 'Scoring guidance',
    guidanceNote: 'Higher scores indicate better perceived quality and less audible reverberation/noise.',
    selectLanguage: 'Select Language',
    english: 'English',
    chinese: 'Chinese',
    reset: 'Reset scores',
    previous: 'Previous',
    next: 'Next',
    review: 'Review submission',
    trial: 'Trial',
    rated: 'rated',
    unrated: 'Unrated',
    navIncomplete: 'Please complete all ratings in this trial before continuing.',
    submitIncomplete: 'Submission failed. Please complete all trial ratings before submitting.',
    submitting: 'Submitting...',
    submitSuccess: 'Submitted successfully. Thank you!',
    submitError: 'Submission failed. A backup JSON file has been downloaded; please send it to the organizers.',
    submissionTitle: 'MUSHRA result submission',
    listenerId: 'Listener ID / name',
    listenerPlaceholder: 'e.g. L01',
    sessionNote: 'Session note',
    sessionPlaceholder: 'optional: headphone, room, date...',
    submit: 'Submit',
    footer: 'MUSHRA scores are stored only in this browser until submitted.',
    utterance: 'Utterance',
    sampleLabel: 'Sample',
    scale: ['Bad', 'Poor', 'Fair', 'Good', 'Excellent'],
  },
  zh: {
    eyebrow: 'MUSHRA 听音评价',
    title: 'MUSHRA 评价',
    guidanceTitle: '评分说明',
    guidanceNote: '分数越高表示感知质量越好，混响/噪声越不明显。',
    selectLanguage: '选择语言',
    english: '英文',
    chinese: '中文',
    reset: '重置评分',
    previous: '上一页',
    next: '下一页',
    review: '查看提交',
    trial: '轮次',
    rated: '已评分',
    unrated: '未评分',
    navIncomplete: '请完成当前轮次的所有评分后再继续。',
    submitIncomplete: '提交失败，请完成所有轮次评分后再提交。',
    submitting: '提交中...',
    submitSuccess: '提交成功，谢谢！',
    submitError: '提交失败。已下载备份 JSON 文件，请将其发送给组织者。',
    submissionTitle: 'MUSHRA 结果提交',
    listenerId: '听众编号 / 姓名',
    listenerPlaceholder: '例如 L01',
    sessionNote: '测试备注',
    sessionPlaceholder: '可选：耳机、环境、日期等',
    submit: '提交',
    footer: 'MUSHRA 分数在提交前仅保存在当前浏览器中。',
    scale: ['很差', '较差', '一般', '良好', '优秀'],
  },
};

const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
const state = {
  scores: saved.scores || {},
  methodOrders: saved.methodOrders || {},
  listenerId: saved.listenerId || '',
  sessionNote: saved.sessionNote || '',
  trialIndex: saved.trialIndex || 0,
  language: saved.language || '',
};

const els = {
  content: document.querySelector('#mushra-content'),
  progress: document.querySelector('#mushra-progress'),
  reset: document.querySelector('#mushra-reset'),
  language: document.querySelector('#mushra-language'),
  previous: document.querySelector('#mushra-prev'),
  next: document.querySelector('#mushra-next'),
  navStatus: document.querySelector('#mushra-nav-status'),
  listenerId: document.querySelector('#mushra-listener-id'),
  sessionNote: document.querySelector('#mushra-session-note'),
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
  document.querySelector('#mushra-guidance-title').textContent = text.guidanceTitle;
  document.querySelector('#mushra-guidance-note').textContent = text.guidanceNote;
  els.language.options[0].textContent = text.selectLanguage;
  els.language.options[1].textContent = text.english;
  els.language.options[2].textContent = text.chinese;
  els.reset.textContent = text.reset;
  els.previous.textContent = text.previous;
  document.querySelector('#mushra-submission-title').textContent = text.submissionTitle;
  document.querySelector('#mushra-listener-id-label').textContent = text.listenerId;
  document.querySelector('#mushra-session-note-label').textContent = text.sessionNote;
  els.listenerId.placeholder = text.listenerPlaceholder;
  els.sessionNote.placeholder = text.sessionPlaceholder;
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
  return `${ROOT}/${trial.sample}/snr${trial.snr}/${method.file}`;
}

function makeAudio(src) {
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.preload = 'none';
  audio.src = encodeURI(src);
  return audio;
}

function setScore(id, score, output, card) {
  state.scores[id] = Number(score);
  output.textContent = Number(score).toFixed(0);
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
  return `Sample ${displayIndex + 1}`;
}

function renderMethod(trial, method, displayIndex) {
  const id = entryId(trial, method);
  const card = document.createElement('article');
  card.className = `mushra-card ${state.scores[id] === undefined ? 'unrated' : 'rated'}`;
  card.dataset.scoreId = id;

  const title = document.createElement('div');
  title.className = 'subjective-card-title';
  title.innerHTML = `<h4>${anonymousMethodLabel(displayIndex)}</h4>`;

  const output = document.createElement('output');
  output.className = 'mushra-score-value';
  output.textContent = state.scores[id] === undefined ? tr('unrated') : Number(state.scores[id]).toFixed(0);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '1';
  slider.value = state.scores[id] ?? 50;
  slider.addEventListener('input', () => setScore(id, slider.value, output, card));

  const ticks = document.createElement('div');
  ticks.className = 'mushra-ticks';
  ticks.innerHTML = '<span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span>';

  const control = document.createElement('div');
  control.className = 'mushra-control';
  control.append(slider, ticks);

  card.append(title, makeAudio(audioPath(trial, method)), control, output);
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
  els.submission.hidden = true;
}

function utteranceLabel(trial) {
  return `Utterance ${SAMPLES.indexOf(trial.sample) + 1}`;
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
    audioRoot: ROOT,
    scoreScale: [0, 100],
    ratedCount: scores.filter(item => item.score !== null).length,
    totalCount: scores.length,
    scores,
  };
}

function downloadPayload(data) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeId = data.listenerId.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'anonymous';
  a.href = url;
  a.download = `nc2026_specsub_raw_mushra_${safeId}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listenerId: data.listenerId,
        sessionNote: data.sessionNote,
        submittedAt: data.exportedAt,
        evaluationType: data.type,
        scoreCount: data.ratedCount,
        totalCount: data.totalCount,
        scoresJson: JSON.stringify(data.scores),
        payloadJson: JSON.stringify(data),
      }),
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
  els.previous.addEventListener('click', () => goToTrial(state.trialIndex - 1));
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
  els.reset.addEventListener('click', () => { state.scores = {}; state.methodOrders = {}; saveState(); render(); });
  els.submit.addEventListener('click', submit);
  render();
}

init();

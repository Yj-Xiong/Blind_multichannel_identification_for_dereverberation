const METHODS = [
  { key: 'wpe', label: 'WPE', kind: 'wpe' },
  { key: 'gwpe', label: 'GWPE', kind: 'gwpe' },
  { key: 'mint_n', label: 'MINT-N', method: 'BCI_NMCFLMS' },
  { key: 'mint_r', label: 'MINT-R', method: 'BCI_RNMCFLMS' },
  { key: 'mint_lp', label: 'MINT-ℓp', method: 'BCI_Lp', p: 1 },
  { key: 'mint_elp', label: 'MINT-Eℓp', method: 'BCI_ELp', p: 1 },
  { key: 'mint_ref', label: 'MINT-Reference', method: 'Oracle_MINT' },
];

const TABLE_ROWS = [
  { branch: 'specsub', snr: 30, lambda: '0.1' },
  { branch: 'specsub', snr: 20, lambda: '0.1' },
  { branch: 'specsub', snr: 10, lambda: '0.1' },
  { branch: 'specsub', snr: 5, lambda: '0.1' },
];

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mpqgvpvo';
const STORAGE_KEY = 'nc2026-subjective-listener-v3';

const TRANSLATIONS = {
  en: {
    eyebrow: 'Subjective listening evaluation',
    title: 'Subjective Scoring for Dereverberation Examples',
    lead: 'All dereverberated examples begin unrated so that listeners can assess the true perceived quality. Listen to the audio and select a score. After scoring, please complete the listener information at the bottom, and the results will be automatically sent to the organizers.',
    guidanceTitle: 'Scoring guidance',
    listeningOrder: 'Recommended listening order: WPE/GWPE → BMCI-MINT methods → MINT-Reference.',
    resetScores: 'Reset scores',
    selectSnr: 'Select SNR',
    allSnrs: 'All',
    selectLanguage: 'Select Language',
    english: 'English',
    chinese: 'Chinese',
    notRated: 'Not rated',
    examples: 'examples',
    empty: 'No subjective examples match the current filters.',
    submissionTitle: 'Result submission',
    listenerId: 'Listener ID / name',
    listenerPlaceholder: 'e.g. L01',
    sessionNote: 'Session note',
    sessionPlaceholder: 'optional: headphone, room, date...',
    submit: 'Submit',
    submitting: 'Submitting...',
    submitSuccess: 'Submitted successfully. Thank you!',
    submitError: 'Submission failed. A backup JSON file has been downloaded; please send it to the organizers.',
    incompleteError: 'Submission failed. Please complete all audio ratings before submitting.',
    rubric: [
      ['1 Bad', 'Severe reverberation/noise; difficult to judge speech quality.'],
      ['2 Poor', 'Limited improvement; reverberation/noise remains strong or speech is distorted.'],
      ['3 Fair', 'Useful dereverberation, but artifacts, residual noise, or coloration remain noticeable.'],
      ['4 Good', 'Clearly improved; mild residual reverberation/noise or slight coloration.'],
      ['5 Excellent', 'Clean, natural, little audible reverberation or noise.'],
    ],
  },
  zh: {
    eyebrow: '主观听音评价',
    title: '去混响音频样例主观评分',
    lead: '所有去混响样例初始均为未评分状态，以便听众评估真实感知质量。请试听音频并选择分数。完成评分后，请在页面底部填写听众信息，结果将自动发送给组织者。',
    guidanceTitle: '评分说明',
    listeningOrder: '推荐听音顺序：WPE/GWPE → BMCI-MINT 方法 → MINT-Reference。',
    resetScores: '重置评分',
    selectSnr: '选择 SNR',
    allSnrs: '全部',
    selectLanguage: '选择语言',
    english: '英文',
    chinese: '中文',
    notRated: '未评分',
    examples: '个样例',
    empty: '没有符合当前筛选条件的主观评价样例。',
    submissionTitle: '结果提交',
    listenerId: '听众编号 / 姓名',
    listenerPlaceholder: '例如 L01',
    sessionNote: '测试备注',
    sessionPlaceholder: '可选：耳机、环境、日期等',
    submit: '提交',
    submitting: '提交中...',
    submitSuccess: '提交成功，谢谢！',
    submitError: '提交失败。已下载备份 JSON 文件，请将其发送给组织者。',
    incompleteError: '提交失败，请完成所有音频评分后再提交。',
    rubric: [
      ['1 很差', '混响/噪声明显严重，难以判断语音质量。'],
      ['2 较差', '改善有限，仍有较强混响/噪声或语音失真。'],
      ['3 一般', '有一定去混响效果，但伪影、残余噪声或音色变化仍较明显。'],
      ['4 良好', '改善明显，仅有轻微残余混响/噪声或轻微音色变化。'],
      ['5 优秀', '语音自然清晰，几乎无可感知混响或噪声。'],
    ],
  },
};

const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
const state = {
  manifest: null,
  scores: saved.scores || {},
  listenerId: saved.listenerId || '',
  sessionNote: saved.sessionNote || '',
  language: saved.language || 'en',
  filters: {
    snr: 'all',
    branch: 'all',
    method: '',
  },
};

const els = {
  content: document.querySelector('#subjective-content'),
  snr: document.querySelector('#snr-filter'),
  language: document.querySelector('#language-filter'),
  method: null,
  reset: document.querySelector('#reset-scores'),
  listenerId: document.querySelector('#listener-id'),
  sessionNote: document.querySelector('#session-note'),
  exportScores: document.querySelector('#export-scores'),
  submitStatus: document.querySelector('#submit-status'),
};

function t(key) {
  return TRANSLATIONS[state.language][key];
}

function applyLanguage() {
  const lang = TRANSLATIONS[state.language];
  document.documentElement.lang = state.language === 'zh' ? 'zh-CN' : 'en';
  document.querySelector('#page-eyebrow').textContent = lang.eyebrow;
  document.querySelector('#page-title').textContent = lang.title;
  document.querySelector('#page-lead').textContent = lang.lead;
  document.querySelector('#guidance-title').textContent = lang.guidanceTitle;
  document.querySelector('#listening-order').textContent = lang.listeningOrder;
  els.reset.textContent = lang.resetScores;
  els.snr.options[0].textContent = lang.selectSnr;
  els.snr.options[1].textContent = lang.allSnrs;
  els.language.options[0].textContent = lang.selectLanguage;
  els.language.options[1].textContent = lang.english;
  els.language.options[2].textContent = lang.chinese;
  document.querySelector('#submission-title').textContent = lang.submissionTitle;
  document.querySelector('#listener-id-label').textContent = lang.listenerId;
  document.querySelector('#session-note-label').textContent = lang.sessionNote;
  els.listenerId.placeholder = lang.listenerPlaceholder;
  els.sessionNote.placeholder = lang.sessionPlaceholder;
  els.exportScores.textContent = lang.submit;
  for (let i = 0; i < lang.rubric.length; i += 1) {
    document.querySelector(`#rubric-${i + 1}-title`).textContent = lang.rubric[i][0];
    document.querySelector(`#rubric-${i + 1}-desc`).textContent = lang.rubric[i][1];
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    listenerId: state.listenerId,
    sessionNote: state.sessionNote,
    language: state.language,
    scores: state.scores,
  }));
}

function branchProcessing(branch) {
  return branch === 'specsub' ? 'SpecSub' : 'Noisy';
}

function normalizeMintreg(lambda) {
  return lambda === '0.1' ? null : lambda;
}

function branchLabel(branch) {
  return branch === 'specsub' ? 'Spectral-subtraction input' : 'Noisy input';
}

function entryId(entry) {
  return `${entry.branch}-${entry.snr}-${entry.lambda}-${entry.method.key}`.replace(/[^a-zA-Z0-9]+/g, '_');
}

function displayCondition(entry) {
  return `SNR ${entry.snr} dB${entry.snr === 5 ? ` · λ = ${entry.lambda}` : ''} · ${branchLabel(entry.branch)}`;
}

function rowEntries() {
  const entries = [];
  for (const row of TABLE_ROWS) {
    for (const method of METHODS) {
      entries.push({ ...row, method });
    }
  }
  return entries;
}

function findItem(row, methodDef) {
  const items = state.manifest.items;
  const snr = row.snr;
  const branch = row.branch;
  const processing = branchProcessing(branch);
  const mintreg = normalizeMintreg(row.lambda);

  if (methodDef.kind === 'input') {
    const inputProcessing = branch === 'specsub' ? 'specsub_mics' : 'noisy_mics';
    const fallbackFile = branch === 'specsub' ? 'raw_specsub_mics.wav' : 'raw_noisy_mics.wav';
    return items.find(item => item.group === 'sim1024_rho0.1'
        && item.snr === snr
        && item.processing === inputProcessing
        && (snr !== 5 || item.mintreg === row.lambda || item.mintreg === mintreg))
      || items.find(item => item.group === 'sim1024_rho0.1'
        && item.snr === snr
        && branch === 'noisy'
        && item.processing === 'norm_noisy_mics')
      || items.find(item => item.group === 'wpe_gwpe_noisy'
        && item.snr === snr
        && item.normalizedFileName === fallbackFile);
  }

  if (methodDef.kind === 'wpe' || methodDef.kind === 'gwpe') {
    return items.find(item => item.group === 'wpe_gwpe_noisy'
      && item.snr === snr
      && item.processing === processing
      && item.methodFamily.toLowerCase() === methodDef.kind);
  }

  return items.find(item => item.group === 'sim1024_rho0.1'
    && item.snr === snr
    && item.processing === processing
    && item.method === methodDef.method
    && (methodDef.p === undefined || item.p === methodDef.p)
    && (snr !== 5 || item.mintreg === row.lambda || item.mintreg === mintreg));
}

function passesFilters(entry) {
  if (state.filters.snr !== 'all' && String(entry.snr) !== state.filters.snr) return false;
  if (state.filters.branch !== 'all' && entry.branch !== state.filters.branch) return false;
  if (state.filters.method) {
    const haystack = `${entry.method.label} ${branchLabel(entry.branch)} ${entry.lambda}`.toLowerCase();
    if (!haystack.includes(state.filters.method)) return false;
  }
  return true;
}

function makeAudio(item) {
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.preload = 'none';
  if (item) audio.src = encodeURI(item.path);
  else audio.className = 'missing-audio';
  return audio;
}

function renderScoreControl(entry) {
  const id = entryId(entry);
  const wrapper = document.createElement('div');
  wrapper.className = 'score-control';

  const options = document.createElement('div');
  options.className = 'score-options';

  const value = document.createElement('output');
  value.className = 'score-value';
  value.textContent = state.scores[id] === undefined ? t('notRated') : Number(state.scores[id]).toFixed(1);

  function updateIntegerButtons(score) {
    for (const button of options.querySelectorAll('.score-option')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.score) === score));
    }
  }

  function setScore(score) {
    state.scores[id] = score;
    saveState();
    updateIntegerButtons(score);
    value.textContent = score.toFixed(1);
    const card = wrapper.closest('.subjective-card');
    card?.classList.remove('unrated');
    card?.classList.add('rated');
  }

  for (const score of [1, 2, 3, 4, 5]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'score-option';
    button.textContent = score;
    button.dataset.score = String(score);
    button.setAttribute('aria-pressed', String(state.scores[id] === score));
    button.addEventListener('click', () => setScore(score));
    options.append(button);
  }

  const stepper = document.createElement('div');
  stepper.className = 'score-stepper';

  const up = document.createElement('button');
  up.type = 'button';
  up.className = 'score-step score-step-up';
  up.textContent = '+0.5';
  up.setAttribute('aria-label', 'Increase score by 0.5');
  up.addEventListener('click', () => {
    const current = state.scores[id] === undefined ? 3 : Number(state.scores[id]);
    setScore(Math.min(5, current + 0.5));
  });

  const down = document.createElement('button');
  down.type = 'button';
  down.className = 'score-step score-step-down';
  down.textContent = '−0.5';
  down.setAttribute('aria-label', 'Decrease score by 0.5');
  down.addEventListener('click', () => {
    const current = state.scores[id] === undefined ? 3 : Number(state.scores[id]);
    setScore(Math.max(1, current - 0.5));
  });

  stepper.append(up, down);
  wrapper.append(options, value, stepper);
  return wrapper;
}

function anonymousMethodLabel(method) {
  return `Sample ${METHODS.findIndex(item => item.key === method.key) + 1}`;
}

function renderCard(entry) {
  const item = findItem(entry, entry.method);
  const card = document.createElement('article');
  card.dataset.scoreId = entryId(entry);
  card.className = `subjective-card ${state.scores[entryId(entry)] === undefined ? 'unrated' : 'rated'}`;

  const title = document.createElement('div');
  title.className = 'subjective-card-title';
  title.innerHTML = `<h4>${anonymousMethodLabel(entry.method)}</h4>`;

  card.append(title, makeAudio(item), renderScoreControl(entry));
  return card;
}

function render() {
  const grouped = new Map();
  for (const entry of rowEntries().filter(passesFilters)) {
    const key = `${entry.branch}|${entry.snr}|${entry.lambda}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  }

  els.content.innerHTML = '';
  if (!grouped.size) {
    els.content.innerHTML = `<p class="empty">${t('empty')}</p>`;
    return;
  }

  for (const [key, entries] of grouped) {
    const [branch, snr, lambda] = key.split('|');
    const section = document.createElement('section');
    section.className = 'subjective-section';
    section.innerHTML = `
      <div class="subjective-section-heading">
        <div>
          <h2>SNR ${snr} dB</h2>
        </div>
        <span>${entries.length} ${t('examples')}</span>
      </div>
    `;

    const grid = document.createElement('div');
    grid.className = 'subjective-grid';
    for (const entry of entries) grid.append(renderCard(entry));
    section.append(grid);
    els.content.append(section);
  }
}

function buildExportData() {
  const entries = rowEntries();
  const scores = entries.map(entry => ({
    id: entryId(entry),
    method: anonymousMethodLabel(entry.method),
    methodKey: entry.method.key,
    branch: entry.branch,
    branchLabel: branchLabel(entry.branch),
    snr: entry.snr,
    lambda: entry.lambda,
    score: state.scores[entryId(entry)] === undefined ? null : Number(state.scores[entryId(entry)]),
  }));
  const ratedCount = scores.filter(item => item.score !== null).length;

  return {
    type: 'nc2026-subjective-scores',
    version: 2,
    exportedAt: new Date().toISOString(),
    listenerId: state.listenerId || 'anonymous',
    sessionNote: state.sessionNote || '',
    scoreScale: [1, 2, 3, 4, 5],
    ratedCount,
    totalCount: scores.length,
    scores,
  };
}

function downloadScores(data) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeId = data.listenerId.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'anonymous';
  a.href = url;
  a.download = `nc2026_subjective_${safeId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function firstUnratedEntry() {
  return rowEntries().find(entry => state.scores[entryId(entry)] === undefined);
}

function scrollToUnrated(entry) {
  const id = entryId(entry);
  const card = document.querySelector(`[data-score-id="${id}"]`);
  if (!card) {
    state.filters.snr = String(entry.snr);
    els.snr.value = String(entry.snr);
    render();
  }
  const target = document.querySelector(`[data-score-id="${id}"]`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('needs-rating');
    setTimeout(() => target.classList.remove('needs-rating'), 1800);
  }
}

async function submitScores() {
  const missing = firstUnratedEntry();
  if (missing) {
    els.submitStatus.textContent = t('incompleteError');
    els.submitStatus.classList.remove('success');
    els.submitStatus.classList.add('error');
    scrollToUnrated(missing);
    return;
  }

  const data = buildExportData();
  els.submitStatus.textContent = t('submitting');
  els.submitStatus.classList.remove('error', 'success');
  els.exportScores.disabled = true;

  try {
    const response = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        listenerId: data.listenerId,
        sessionNote: data.sessionNote,
        submittedAt: data.exportedAt,
        scoreCount: data.ratedCount,
        totalCount: data.totalCount,
        scoresJson: JSON.stringify(data.scores),
        payloadJson: JSON.stringify(data),
      }),
    });

    if (!response.ok) throw new Error('Submission failed.');
    els.submitStatus.textContent = t('submitSuccess');
    els.submitStatus.classList.add('success');
  } catch (error) {
    els.submitStatus.textContent = t('submitError');
    els.submitStatus.classList.add('error');
    downloadScores(data);
  } finally {
    els.exportScores.disabled = false;
  }
}

async function init() {
  const response = await fetch('./audio-manifest.json');
  if (!response.ok) throw new Error('audio-manifest.json not found. Run node scripts/generate-manifest.mjs first.');
  state.manifest = await response.json();

  els.language.value = state.language;
  els.listenerId.value = state.listenerId;
  els.sessionNote.value = state.sessionNote;
  applyLanguage();

  els.language.addEventListener('change', () => {
    state.language = els.language.value || 'en';
    saveState();
    applyLanguage();
    render();
  });

  els.listenerId.addEventListener('input', () => {
    state.listenerId = els.listenerId.value.trim();
    saveState();
  });
  els.sessionNote.addEventListener('input', () => {
    state.sessionNote = els.sessionNote.value.trim();
    saveState();
  });
  els.exportScores.addEventListener('click', submitScores);
  els.snr.addEventListener('change', () => {
    state.filters.snr = els.snr.value;
    render();
  });
  els.reset.addEventListener('click', () => {
    state.scores = {};
    saveState();
    render();
  });

  render();
}

init().catch(error => {
  els.content.innerHTML = `<p class="empty">${error.message}</p>`;
});

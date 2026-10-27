const ENDPOINT = 'https://formspree.io/f/mpqgvpvo';
const STORAGE_KEY = 'ace56-air30-se-v1';
const COMPLETED_KEY = 'ace56-air30-se-completed-v1';
const CANDIDATE_KEYS = ['hidden_reference', 'lowpass_anchor', 'unprocessed'];
const $ = (selector) => document.querySelector(selector);
const ui = {
  setup: $('#setup'), study: $('#study'), review: $('#review'),
  listener: $('#listener-id'), experience: $('#experience'), device: $('#device'),
  dataset: $('#dataset'), batch: $('#batch'), coverage: $('#coverage'),
  setupError: $('#setup-error'), trialList: $('#trial-list'),
  trialKicker: $('#trial-kicker'), trialTitle: $('#trial-title'), trialMeta: $('#trial-meta'),
  progressLabel: $('#progress-label'),
  ratedCount: $('#rated-count'), reference: $('#reference-audio'), candidates: $('#candidate-list'),
  previous: $('#previous'), next: $('#next'), navProgress: $('#nav-progress'),
  trialError: $('#trial-error'), reviewSummary: $('#review-summary'),
  reviewChecks: $('#review-checks'), submitError: $('#submit-error'),
  submit: $('#submit'), download: $('#download'), nextBatch: $('#next-batch'), saveState: $('#save-state'),
};
let manifest;
let state;

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function shuffle(items, seed) {
  const result = [...items];
  let value = seed || 1;
  for (let i = result.length - 1; i > 0; i -= 1) {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    const j = (value >>> 0) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function batches(dataset) {
  const pool = manifest.trials.filter((trial) => trial.dataset === dataset);
  if (dataset === 'ACE') {
    const scenes = [...new Set(pool.map((trial) => trial.scene_id))].sort();
    const bySceneAndSnr = new Map(pool.map((trial) => [`${trial.scene_id}:${trial.snr_db}`, trial]));
    if (scenes.length !== 14 || pool.length !== 56) throw new Error('ACE 样本清单不完整');
    return Array.from({ length: 7 }, (_, batchIndex) => [10, 20, 30, 40].flatMap((snr, snrIndex) => {
      const pair = ((batchIndex + snrIndex) % 7) * 2;
      return [scenes[pair], scenes[pair + 1]].map((scene) => bySceneAndSnr.get(`${scene}:${snr}`));
    }));
  }
  const groups = [];
  for (let index = 0; index < pool.length; index += 8) groups.push(pool.slice(index, index + 8));
  return groups;
}

function completedFor(listenerId) {
  try { return JSON.parse(localStorage.getItem(COMPLETED_KEY) || '{}')[listenerId] || {}; }
  catch { return {}; }
}

function renderBatchOptions() {
  const groups = batches(ui.dataset.value || 'ACE');
  const selected = Number(ui.batch.value) || 0;
  const done = completedFor(ui.listener.value.trim());
  ui.batch.replaceChildren();
  groups.forEach((group, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `第 ${index + 1} 批 · ${group.length} 条${done[`${ui.dataset.value}:${index}`] ? ' · 已提交' : ''}`;
    ui.batch.append(option);
  });
  ui.batch.value = String(Math.min(selected, groups.length - 1));
  const completed = Object.keys(done).filter((key) => done[key]).length;
  ui.coverage.textContent = `当前编号已提交 ${completed} / ${batches('ACE').length + batches('AIR').length} 批。`;
}

function candidates(trial) {
  return shuffle([...CANDIDATE_KEYS, ...manifest.models.map((model) => model.id)], hash(`${state.listenerId}:${trial.sample_id}`));
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  ui.saveState.textContent = '已保存在本机';
}

function getTrial(index = state.index) {
  return manifest.trials.find((trial) => trial.sample_id === state.trialIds[index]);
}

function complete(trial) {
  return candidates(trial).every((key) => Number.isInteger(state.scores[trial.sample_id]?.[key]));
}

function pauseOtherAudio(current) {
  document.querySelectorAll('audio').forEach((player) => {
    if (player !== current) player.pause();
  });
}

function renderRail() {
  ui.trialList.replaceChildren();
  state.trialIds.forEach((id, index) => {
    const trial = getTrial(index);
    const button = document.createElement('button');
    button.className = `trial-jump${index === state.index ? ' active' : ''}${complete(trial) ? ' done' : ''}`;
    button.type = 'button';
    button.innerHTML = `<span class="trial-index">${String(index + 1).padStart(2, '0')}</span><span><strong>${trial.dataset}</strong><small>${trial.snr_db} dB SNR</small></span><span class="trial-check">${complete(trial) ? '✓' : ''}</span>`;
    button.addEventListener('click', () => { state.index = index; save(); render(); });
    ui.trialList.append(button);
  });
  ui.progressLabel.textContent = `${state.trialIds.filter((_, index) => complete(getTrial(index))).length} / ${state.trialIds.length}`;
}

function candidateCard(trial, key, index) {
  const score = state.scores[trial.sample_id]?.[key];
  const card = document.createElement('div');
  card.className = `candidate${Number.isInteger(score) ? ' rated' : ''}`;
  const head = document.createElement('div');
  head.className = 'candidate-head';
  const title = document.createElement('strong');
  title.textContent = `样本 ${String.fromCharCode(65 + index)}`;
  const value = document.createElement('span');
  value.className = 'score-value';
  value.textContent = Number.isInteger(score) ? String(score) : '未评分';
  head.append(title, value);
  const player = document.createElement('audio');
  player.controls = true;
  player.preload = 'none';
  player.src = trial.tracks[key].file;
  const control = document.createElement('div');
  control.className = 'score-control';
  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.step = '1';
  slider.value = Number.isInteger(score) ? String(score) : '50';
  slider.disabled = Boolean(state.submittedAt);
  slider.setAttribute('aria-label', `样本 ${String.fromCharCode(65 + index)} 评分`);
  const number = document.createElement('input');
  number.type = 'number'; number.min = '0'; number.max = '100'; number.step = '1';
  number.placeholder = '—'; number.value = Number.isInteger(score) ? String(score) : '';
  number.disabled = Boolean(state.submittedAt);
  number.setAttribute('aria-label', `样本 ${String.fromCharCode(65 + index)} 分数`);
  const update = (raw) => {
    const next = Number(raw);
    if (!Number.isInteger(next) || next < 0 || next > 100) return;
    state.scores[trial.sample_id] ||= {};
    state.scores[trial.sample_id][key] = next;
    slider.value = String(next); number.value = String(next); value.textContent = String(next);
    card.classList.add('rated');
    save(); updateProgress();
  };
  slider.addEventListener('input', () => update(slider.value));
  number.addEventListener('change', () => update(number.value));
  control.append(slider, number);
  card.append(head, player, control);
  return card;
}

function updateProgress() {
  const trial = getTrial();
  const rated = candidates(trial).filter((key) => Number.isInteger(state.scores[trial.sample_id]?.[key])).length;
  ui.ratedCount.textContent = `${rated} / ${candidates(trial).length} 已评分`;
  ui.next.disabled = rated !== candidates(trial).length;
  ui.trialError.textContent = '';
  renderRail();
}

function renderTrial() {
  const trial = getTrial();
  ui.trialKicker.textContent = `${trial.dataset} 测试集 · v1.0.1`;
  ui.trialTitle.textContent = `片段 ${state.index + 1}`;
  ui.trialMeta.textContent = `${trial.snr_db} dB SNR · 16 kHz · 单轮比较`;
  ui.reference.src = trial.tracks.reference.file;
  ui.reference.load();
  ui.candidates.replaceChildren(...candidates(trial).map((key, index) => candidateCard(trial, key, index)));
  ui.previous.disabled = state.index === 0;
  ui.next.textContent = state.index === state.trialIds.length - 1 ? '检查并提交' : '下一条';
  ui.navProgress.textContent = `${state.index + 1} / ${state.trialIds.length}`;
  updateProgress();
}

function renderReview() {
  const allComplete = state.trialIds.every((_, index) => complete(getTrial(index)));
  ui.reviewSummary.textContent = `${state.listenerId} · ${state.dataset} 第 ${state.batchIndex + 1} 批 · ${state.trialIds.length} 条 · ${allComplete ? '评分完整' : '仍有未评分片段'}`;
  ui.reviewChecks.replaceChildren();
  state.trialIds.forEach((_, index) => {
    const trial = getTrial(index);
    const row = document.createElement('button');
    row.type = 'button'; row.className = 'review-row';
    row.textContent = `${String(index + 1).padStart(2, '0')}  ${trial.dataset} · ${trial.snr_db} dB SNR    ${complete(trial) ? '已完成 ✓' : '未完成'}`;
    row.addEventListener('click', () => { state.index = index; save(); render(); });
    ui.reviewChecks.append(row);
  });
  ui.submit.disabled = !allComplete || Boolean(state.submittedAt);
  ui.download.hidden = !state.submittedAt;
  ui.nextBatch.hidden = !state.submittedAt;
  ui.nextBatch.textContent = state.batchIndex + 1 < batches(state.dataset).length ? '继续下一批' : '返回批次选择';
  ui.submitError.textContent = state.submittedAt ? '提交成功，已保存本次记录。' : '';
}

function render() {
  ui.setup.hidden = Boolean(state);
  ui.study.hidden = !state || state.index === state.trialIds.length;
  ui.review.hidden = !state || state.index !== state.trialIds.length;
  if (!state) { if (manifest) renderBatchOptions(); return; }
  if (state.index === state.trialIds.length) renderReview();
  else renderTrial();
}

function resultPayload() {
  return {
    schema: 'se.subjective.mushra_style.v1', study: manifest.study,
    datasetVersion: manifest.dataset_version, sessionId: state.sessionId,
    dataset: state.dataset, batchIndex: state.batchIndex, batchNumber: state.batchIndex + 1,
    listenerId: state.listenerId, experience: state.experience, device: state.device,
    submittedAt: new Date().toISOString(),
    results: state.trialIds.map((_, index) => {
      const trial = getTrial(index);
      return { dataset: trial.dataset, sample_id: trial.sample_id, scene_id: trial.scene_id,
        room: trial.room, array_type: trial.array_type, snr_db: trial.snr_db,
        candidateOrder: candidates(trial), scores: state.scores[trial.sample_id] };
    }),
  };
}

function download(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `ace-air-listening-${state.sessionId}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function submit() {
  if (!state.trialIds.every((_, index) => complete(getTrial(index)))) {
    ui.submitError.textContent = '请完成所有片段评分。'; return;
  }
  const payload = resultPayload();
  ui.submit.disabled = true;
  ui.submitError.textContent = '提交中…';
  try {
    const response = await fetch(ENDPOINT, { method: 'POST', headers: {
      'Content-Type': 'application/json', Accept: 'application/json',
    }, body: JSON.stringify({ type: 'ace56-air30-se-v1', study: payload.study,
      listenerId: payload.listenerId, sessionId: payload.sessionId,
      dataset: payload.dataset, batchNumber: payload.batchNumber, payloadJson: JSON.stringify(payload) }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.submittedAt = payload.submittedAt;
    state.submittedPayload = payload;
    const allCompleted = JSON.parse(localStorage.getItem(COMPLETED_KEY) || '{}');
    allCompleted[state.listenerId] ||= {};
    allCompleted[state.listenerId][`${state.dataset}:${state.batchIndex}`] = payload.submittedAt;
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(allCompleted));
    save(); renderReview();
  } catch (error) {
    ui.submitError.textContent = `提交失败（${error.message}）。已下载本地备份，请交给组织者。`;
    download(payload);
    ui.submit.disabled = false;
  }
}

async function init() {
  try {
    const response = await fetch('manifest.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    manifest = await response.json();
    const params = new URLSearchParams(window.location.search);
    if (['ACE', 'AIR'].includes(params.get('dataset'))) ui.dataset.value = params.get('dataset');
    renderBatchOptions();
    const batchNumber = Number(params.get('batch'));
    if (Number.isInteger(batchNumber) && batchNumber >= 1 && batchNumber <= batches(ui.dataset.value).length) ui.batch.value = String(batchNumber - 1);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.study === manifest.study && parsed.trialIds.every((id) => manifest.trials.some((trial) => trial.sample_id === id))) state = parsed;
    }
    render();
  } catch (error) {
    ui.setupError.textContent = `音频清单加载失败：${error.message}`;
    $('#start').disabled = true;
  }
}

$('#start').addEventListener('click', () => {
  const listenerId = ui.listener.value.trim();
  if (!listenerId) { ui.setupError.textContent = '请输入听评者编号。'; ui.listener.focus(); return; }
  const dataset = ui.dataset.value;
  const batchIndex = Number(ui.batch.value);
  const batch = batches(dataset)[batchIndex];
  if (!batch?.length) { ui.setupError.textContent = '请选择有效批次。'; return; }
  state = { study: manifest.study, sessionId: crypto.randomUUID(), listenerId,
    experience: ui.experience.value, device: ui.device.value, dataset, batchIndex, index: 0,
    trialIds: batch.map((trial) => trial.sample_id), scores: {} };
  save(); render();
});
ui.previous.addEventListener('click', () => { state.index -= 1; save(); render(); });
ui.next.addEventListener('click', () => {
  if (!complete(getTrial())) { ui.trialError.textContent = '请给本轮全部样本评分。'; return; }
  state.index += 1; save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('#back-to-trials').addEventListener('click', () => { state.index = state.trialIds.length - 1; save(); render(); });
ui.submit.addEventListener('click', submit);
ui.download.addEventListener('click', () => download(state.submittedPayload || resultPayload()));
ui.nextBatch.addEventListener('click', () => {
  const next = Math.min(state.batchIndex + 1, batches(state.dataset).length - 1);
  ui.listener.value = state.listenerId;
  ui.dataset.value = state.dataset;
  state = null; localStorage.removeItem(STORAGE_KEY);
  renderBatchOptions(); ui.batch.value = String(next); render();
});
ui.dataset.addEventListener('change', renderBatchOptions);
ui.listener.addEventListener('input', renderBatchOptions);
$('#reset').addEventListener('click', () => {
  if (!confirm('清除本机当前听评进度并重新开始？')) return;
  localStorage.removeItem(STORAGE_KEY); state = null; render();
});
document.addEventListener('play', (event) => { if (event.target instanceof HTMLAudioElement) pauseOtherAudio(event.target); }, true);
init();

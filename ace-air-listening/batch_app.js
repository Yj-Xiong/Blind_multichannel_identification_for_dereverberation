const ENDPOINT = 'https://formspree.io/f/mpqgvpvo';
const MANIFEST_URL = document.body.dataset.manifest || 'batch_manifest.json';
const STORAGE_PREFIX = 'dereverb-p808-batch-v1:';
const BATCH_SIZE = 10;
const CANDIDATE_KEYS = ['hidden_reference', 'unprocessed'];
const $ = (selector) => document.querySelector(selector);
const ui = {
  setup: $('#setup'), study: $('#study'), review: $('#review'), done: $('#done'),
  listener: $('#listener-id'), experience: $('#experience'), device: $('#device'),
  setupError: $('#setup-error'), trialList: $('#trial-list'), trialPicker: $('#trial-picker'),
  batchLabel: $('#batch-label'), submittedLabel: $('#submitted-label'),
  trialKicker: $('#trial-kicker'), trialTitle: $('#trial-title'), progressLabel: $('#progress-label'),
  ratedCount: $('#rated-count'), reference: $('#reference-audio'), candidates: $('#candidate-list'),
  previous: $('#previous'), next: $('#next'), navProgress: $('#nav-progress'),
  trialError: $('#trial-error'), reviewSummary: $('#review-summary'), submitError: $('#submit-error'),
  submit: $('#submit'), download: $('#download'), saveState: $('#save-state'),
  doneSummary: $('#done-summary'), doneError: $('#done-error'), nextBatch: $('#next-batch'),
  downloadLast: $('#download-last'), reset: $('#reset'), start: $('#start'),
};
let manifest;
let state;
let trialById;
let candidateIds;
let allTrials;

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
  for (let index = result.length - 1; index > 0; index -= 1) {
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    const swap = (value >>> 0) % (index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function stateKey(listenerId) { return STORAGE_PREFIX + listenerId; }
function save() {
  localStorage.setItem(stateKey(state.listenerId), JSON.stringify(state));
  ui.saveState.textContent = '已保存在本机';
}
function getTrial(index = state.index) { return trialById.get(state.trialIds[index]); }
function validScore(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10
    && Math.abs(value * 10 - Math.round(value * 10)) < 1e-8;
}
function complete(trial) {
  const scores = CANDIDATE_KEYS.concat(manifest.models.map((model) => model.id))
    .map((key) => state.scores[trial.sample_id]?.[key]);
  return scores.every(validScore)
    && new Set(scores.map((score) => score.toFixed(1))).size === scores.length;
}

function candidates(trial) {
  return shuffle(CANDIDATE_KEYS.concat(manifest.models.map((model) => model.id)),
    hash(state.listenerId + ':' + trial.sample_id));
}

function pickNextBatch() {
  const used = new Set(state.usedSampleIds);
  const order = shuffle(allTrials, hash(state.listenerId + ':sample-order'));
  const selected = order.filter((trial) => !used.has(trial.sample_id)).slice(0, BATCH_SIZE);
  if (!selected.length) return false;
  state.round += 1;
  state.trialIds = selected.map((trial) => trial.sample_id);
  state.index = 0;
  state.scores = {};
  state.submittedAt = null;
  state.currentPayload = null;
  return true;
}

function startOrResume(listenerId) {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(stateKey(listenerId))); } catch {}
  if (saved && saved.study === manifest.study && saved.audioVersion === manifest.audio_version) {
    state = saved;
    return true;
  }
  state = { study: manifest.study, audioVersion: manifest.audio_version,
    listenerId, sessionId: crypto.randomUUID(), experience: ui.experience.value,
    device: ui.device.value, round: 0, index: 0, trialIds: [], scores: {},
    usedSampleIds: [], submittedBatches: [], submittedAt: null, currentPayload: null };
  return pickNextBatch();
}

function renderRail() {
  const done = state.trialIds.map((id) => complete(trialById.get(id)));
  const firstIncomplete = done.indexOf(false);
  const maxNavigable = firstIncomplete < 0 ? done.length - 1 : firstIncomplete;
  ui.trialList.replaceChildren();
  state.trialIds.forEach((id, index) => {
    const trial = trialById.get(id);
    const button = document.createElement('button');
    button.className = 'trial-jump' + (index === state.index ? ' active' : '') + (done[index] ? ' done' : '');
    button.type = 'button'; button.disabled = index > maxNavigable;
    button.innerHTML = '<span class="trial-index">' + String(index + 1).padStart(2, '0') + '</span><span><strong>' + trial.dataset + '</strong></span><span class="trial-check">' + (done[index] ? '✓' : '') + '</span>';
    button.addEventListener('click', () => { state.index = index; save(); render(); });
    ui.trialList.append(button);
  });
  Array.from(ui.trialPicker.options).forEach((option, index) => { option.disabled = index > maxNavigable; });
  ui.trialPicker.value = String(state.index);
  ui.progressLabel.textContent = done.filter(Boolean).length + ' / ' + state.trialIds.length;
  ui.batchLabel.textContent = String(state.round);
  ui.submittedLabel.textContent = String(state.submittedBatches.length);
}

function scoreCard(trial, key, index) {
  const card = document.createElement('div');
  const existing = state.scores[trial.sample_id]?.[key];
  card.className = 'candidate' + (validScore(existing) ? ' rated' : '');
  card.dataset.key = key;
  const head = document.createElement('div'); head.className = 'candidate-head';
  const title = document.createElement('strong'); title.textContent = '样本 ' + String.fromCharCode(65 + index);
  const value = document.createElement('span'); value.className = 'score-value';
  value.textContent = validScore(existing) ? existing.toFixed(1) : '未评分';
  head.append(title, value);
  const player = document.createElement('audio'); player.controls = true; player.preload = 'none'; player.src = trial.tracks[key].file;
  const control = document.createElement('div'); control.className = 'score-control';
  const slider = document.createElement('input'); slider.type = 'range';
  slider.min = '0'; slider.max = '10'; slider.step = '0.1'; slider.value = validScore(existing) ? existing.toFixed(1) : '5.0';
  const number = document.createElement('input'); number.type = 'number';
  number.min = '0'; number.max = '10'; number.step = '0.1'; number.placeholder = '—';
  number.value = validScore(existing) ? existing.toFixed(1) : '';
  const update = (raw) => {
    if (raw === '') return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) return;
    const next = Math.round(parsed * 10) / 10;
    state.scores[trial.sample_id] ||= {};
    state.scores[trial.sample_id][key] = next;
    slider.value = next.toFixed(1); number.value = next.toFixed(1);
    value.textContent = next.toFixed(1); card.classList.add('rated'); save(); updateProgress();
  };
  slider.addEventListener('input', () => update(slider.value));
  number.addEventListener('change', () => update(number.value));
  control.append(slider, number); card.append(head, player, control);
  return card;
}

function updateProgress() {
  const trial = getTrial();
  const scored = complete(trial);
  ui.ratedCount.textContent = scored ? '已评分' : '未评分';
  ui.next.disabled = !scored;
  const scores = candidateIds.map((key) => state.scores[trial.sample_id]?.[key]).filter(validScore);
  const duplicate = new Set(scores.map((score) => score.toFixed(1))).size !== scores.length;
  ui.trialError.textContent = duplicate ? '本批有相同分数，请调整高亮的音频评分。' : '';
  const counts = new Map();
  scores.forEach((score) => counts.set(score.toFixed(1), (counts.get(score.toFixed(1)) || 0) + 1));
  ui.candidates.querySelectorAll('.candidate').forEach((card) => {
    const score = state.scores[trial.sample_id]?.[card.dataset.key];
    card.classList.toggle('conflict', validScore(score) && counts.get(score.toFixed(1)) > 1);
  });
  renderRail();
}

function renderTrial() {
  const trial = getTrial();
  ui.trialKicker.textContent = trial.dataset + ' 测试集 · v1.0.1';
  ui.trialTitle.textContent = '第 ' + (state.index + 1) + ' / ' + state.trialIds.length + ' 条';
  ui.reference.src = trial.tracks.reference.file; ui.reference.load();
  ui.candidates.replaceChildren(...candidates(trial).map((key, index) => scoreCard(trial, key, index)));
  ui.previous.disabled = state.index === 0;
  ui.next.textContent = state.index === state.trialIds.length - 1 ? '检查并提交' : '下一条';
  ui.navProgress.textContent = (state.index + 1) + ' / ' + state.trialIds.length;
  updateProgress();
}

function renderReview() {
  ui.reviewSummary.textContent = '第 ' + state.round + ' 批，共 ' + state.trialIds.length + ' 条样本。提交后可以继续下一批，已完成样本不会再次抽取。';
  ui.submit.disabled = !state.trialIds.every((id) => complete(trialById.get(id)));
  ui.submitError.textContent = state.submittedAt ? '本批已提交。' : '';
  ui.download.hidden = !state.submittedAt;
}

function renderDone() {
  const remaining = allTrials.length - state.usedSampleIds.length;
  ui.doneSummary.textContent = remaining ? '第 ' + state.round + ' 批已提交，还剩 ' + remaining + ' 条未抽取样本。' : '所有可抽取样本都已完成。';
  ui.nextBatch.disabled = !remaining;
}

function render() {
  ui.setup.hidden = Boolean(state);
  const active = Boolean(state && state.trialIds.length);
  ui.study.hidden = !active || state.index === state.trialIds.length;
  ui.review.hidden = !active || state.index !== state.trialIds.length || Boolean(state.submittedAt);
  ui.done.hidden = !state || !state.submittedAt;
  if (!state) return;
  if (state.submittedAt) renderDone(); else if (state.index === state.trialIds.length) renderReview(); else renderTrial();
}

function payload() {
  return { schema: 'se.subjective.p808_short_batch.v1', study: manifest.study,
    audioVersion: manifest.audio_version, batchSize: state.trialIds.length, round: state.round,
    listenerId: state.listenerId, sessionId: state.sessionId,
    scale: {min: 0, max: 10, step: 0.1, uniquePerTrial: true},
    experience: state.experience,
    device: state.device, submittedAt: new Date().toISOString(), results: state.trialIds.map((id) => {
      const trial = trialById.get(id);
      return {sample_id: id, order: candidates(trial), score: state.scores[id]};
    }) };
}

function download(value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = 'dereverb-p808-' + state.listenerId + '-batch-' + state.round + '.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function submit() {
  const value = payload(); ui.submit.disabled = true; ui.submitError.textContent = '提交中…';
  try {
    const response = await fetch(ENDPOINT, {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json'},
      body: JSON.stringify({type: 'dereverb-p808-batch-v1', study: value.study, listenerId: value.listenerId, sessionId: value.sessionId, round: value.round, payloadJson: JSON.stringify(value)})});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    state.usedSampleIds.push(...state.trialIds); state.submittedBatches.push({round: state.round, sampleIds: state.trialIds, submittedAt: value.submittedAt});
    state.submittedAt = value.submittedAt; state.currentPayload = value; save(); render();
  } catch (error) { ui.submitError.textContent = '提交失败（' + error.message + '）。已下载本批记录。'; download(value); ui.submit.disabled = false; }
}

async function init() {
  try {
    const response = await fetch(MANIFEST_URL, {cache: 'no-store'}); if (!response.ok) throw new Error('HTTP ' + response.status);
    manifest = await response.json(); allTrials = manifest.trials;
    if (manifest.study !== 'dereverb-p808-batch-v1' || allTrials.length !== 163) throw new Error('P.808 分批清单不完整');
    trialById = new Map(allTrials.map((trial) => [trial.sample_id, trial]));
    candidateIds = CANDIDATE_KEYS.concat(manifest.models.map((model) => model.id));
  } catch (error) { ui.setupError.textContent = '音频清单加载失败：' + error.message; ui.start.disabled = true; }
}

ui.start.addEventListener('click', () => {
  const listenerId = ui.listener.value.trim();
  if (!listenerId) { ui.setupError.textContent = '请输入听评者编号。'; ui.listener.focus(); return; }
  if (!startOrResume(listenerId)) { ui.setupError.textContent = '所有样本都已完成。'; return; }
  save(); render();
});
ui.trialPicker.addEventListener('change', () => { state.index = Number(ui.trialPicker.value); save(); render(); });
ui.previous.addEventListener('click', () => { state.index -= 1; save(); render(); });
ui.next.addEventListener('click', () => { if (complete(getTrial())) { state.index += 1; save(); render(); } });
ui.backToTrials.addEventListener('click', () => { state.index = state.trialIds.length - 1; save(); render(); });
ui.submit.addEventListener('click', submit);
ui.download.addEventListener('click', () => download(state.currentPayload || payload()));
ui.nextBatch.addEventListener('click', () => { delete state.submittedAt; if (!pickNextBatch()) return; save(); render(); });
ui.downloadLast.addEventListener('click', () => download(state.currentPayload));
ui.reset.addEventListener('click', () => { if (!confirm('清除这个听评 ID 的本机进度并重新开始？')) return; localStorage.removeItem(stateKey(state?.listenerId || ui.listener.value.trim())); state = null; render(); });
document.addEventListener('play', (event) => { if (event.target instanceof HTMLAudioElement) document.querySelectorAll('audio').forEach((player) => { if (player !== event.target) player.pause(); }); }, true);
init();

import { migrateAirAudio } from './audio_revision.mjs';
import { orderedTrials, STUDIES } from './study_modes.mjs';

const ENDPOINT = 'https://formspree.io/f/mpqgvpvo';
const MODE = document.body.dataset.study || 'joint';
const CONFIG = STUDIES[MODE];
if (!CONFIG) throw new Error('未知听评入口');
const STORAGE_KEY = CONFIG.storageKey;
const CANDIDATE_KEYS = ['hidden_reference', 'unprocessed'];
const $ = (selector) => document.querySelector(selector);
const ui = {
  setup: $('#setup'), study: $('#study'), review: $('#review'),
  listener: $('#listener-id'), experience: $('#experience'), device: $('#device'),
  setupError: $('#setup-error'), trialList: $('#trial-list'),
  trialPicker: $('#trial-picker'), aceProgress: $('#ace-progress'), airProgress: $('#air-progress'),
  trialKicker: $('#trial-kicker'), trialTitle: $('#trial-title'),
  progressLabel: $('#progress-label'),
  audioUpdateNotice: $('#audio-update-notice'),
  ratedCount: $('#rated-count'), reference: $('#reference-audio'), candidates: $('#candidate-list'),
  previous: $('#previous'), next: $('#next'), navProgress: $('#nav-progress'),
  trialError: $('#trial-error'), reviewSummary: $('#review-summary'),
  reviewChecks: $('#review-checks'), submitError: $('#submit-error'),
  submit: $('#submit'), download: $('#download'), exportCurrent: $('#export-current'), saveState: $('#save-state'),
};
let manifest;
let state;
let trialById;
let candidateIds;
let trials;

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

function candidates(trial) {
  return shuffle([...CANDIDATE_KEYS, ...manifest.models.map((model) => model.id)],
    hash(`${state.listenerId}:${trial.sample_id}`));
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  ui.saveState.textContent = '已保存在本机';
}

function getTrial(index = state.index) {
  return trialById.get(state.trialIds[index]);
}

function validScore(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10
    && Math.abs(value * 10 - Math.round(value * 10)) < 1e-8;
}

function complete(trial) {
  const scores = candidateIds.map((key) => state.scores[trial.sample_id]?.[key]);
  return scores.every(validScore);
}

function pauseOtherAudio(current) {
  document.querySelectorAll('audio').forEach((player) => {
    if (player !== current) player.pause();
  });
}

function renderRail() {
  const done = state.trialIds.map((_, index) => complete(getTrial(index)));
  const firstIncomplete = done.indexOf(false);
  const maxNavigable = firstIncomplete === -1 ? done.length - 1 : firstIncomplete;
  const end = Math.min(state.trialIds.length, Math.max(state.index + 5, 9));
  const start = Math.max(0, end - 9);
  ui.trialList.replaceChildren();
  for (let index = start; index < end; index += 1) {
    const trial = getTrial(index);
    const button = document.createElement('button');
    button.className = `trial-jump${index === state.index ? ' active' : ''}${done[index] ? ' done' : ''}`;
    button.type = 'button';
    button.disabled = index > maxNavigable;
    button.innerHTML = `<span class="trial-index">${String(index + 1).padStart(3, '0')}</span><span><strong>${trial.dataset}</strong></span><span class="trial-check">${done[index] ? '✓' : ''}</span>`;
    button.addEventListener('click', () => { state.index = index; save(); render(); });
    ui.trialList.append(button);
  }
  Array.from(ui.trialPicker.options).forEach((option, index) => { option.disabled = index > maxNavigable; });
  ui.trialPicker.value = String(state.index);
  ui.progressLabel.textContent = `${done.filter(Boolean).length} / ${state.trialIds.length}`;
  for (const [dataset, element] of [['ACE', ui.aceProgress], ['AIR', ui.airProgress]]) {
    element.parentElement.hidden = !CONFIG.datasets.includes(dataset);
    const matching = state.trialIds.map((id, index) => getTrial(index).dataset === dataset ? done[index] : null)
      .filter((value) => value !== null);
    element.textContent = `${matching.filter(Boolean).length} / ${matching.length}`;
  }
}

function candidateCard(trial, key, index) {
  const score = state.scores[trial.sample_id]?.[key];
  const card = document.createElement('div');
  card.className = `candidate${validScore(score) ? ' rated' : ''}`;
  card.dataset.key = key;
  const head = document.createElement('div');
  head.className = 'candidate-head';
  const title = document.createElement('strong');
  const label = `样本 ${String.fromCharCode(65 + index)}`;
  title.textContent = label;
  const value = document.createElement('span');
  value.className = 'score-value';
  value.textContent = validScore(score) ? score.toFixed(1) : '未评分';
  head.append(title, value);
  const player = document.createElement('audio');
  player.controls = true;
  player.preload = 'none';
  player.src = trial.tracks[key].file;
  const control = document.createElement('div');
  control.className = 'score-control';
  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = '0'; slider.max = '10'; slider.step = '0.1';
  slider.value = validScore(score) ? score.toFixed(1) : '5.0';
  slider.disabled = Boolean(state.submittedAt);
  slider.setAttribute('aria-label', `${label}评分`);
  const number = document.createElement('input');
  number.type = 'number'; number.min = '0'; number.max = '10'; number.step = '0.1';
  number.placeholder = '—'; number.value = validScore(score) ? score.toFixed(1) : '';
  number.disabled = Boolean(state.submittedAt);
  number.setAttribute('aria-label', `${label}分数`);
  const update = (raw) => {
    if (raw === '') return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) return;
    const next = Math.round(parsed * 10) / 10;
    state.scores[trial.sample_id] ||= {};
    state.scores[trial.sample_id][key] = next;
    slider.value = next.toFixed(1); number.value = next.toFixed(1); value.textContent = next.toFixed(1);
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
  const scores = state.scores[trial.sample_id] || {};
  const rated = candidateIds.filter((key) => validScore(scores[key])).length;
  ui.candidates.querySelectorAll('.candidate').forEach((card) => {
    card.classList.remove('conflict');
  });
  ui.ratedCount.textContent = `${rated} / ${candidateIds.length} 已评分`;
  ui.next.disabled = !complete(trial);
  ui.trialError.textContent = '';
  renderRail();
}

function renderTrial() {
  const trial = getTrial();
  ui.trialKicker.textContent = `${trial.dataset} 测试集 · v1.0.1`;
  ui.trialTitle.textContent = `片段 ${state.index + 1}`;
  ui.reference.src = trial.tracks.reference.file;
  ui.reference.load();
  ui.candidates.replaceChildren(...candidates(trial).map((key, index) => candidateCard(trial, key, index)));
  ui.previous.disabled = state.index === 0;
  ui.next.textContent = state.index === state.trialIds.length - 1
    ? '检查并提交' : MODE === 'joint' && state.index === 55 ? '进入 AIR' : '下一条';
  ui.navProgress.textContent = `${state.index + 1} / ${state.trialIds.length}`;
  updateProgress();
}

function renderReview() {
  const done = state.trialIds.map((_, index) => complete(getTrial(index)));
  const allComplete = done.every(Boolean);
  const summary = CONFIG.datasets.map((dataset) => {
    const matching = state.trialIds.map((id, index) => getTrial(index).dataset === dataset ? done[index] : null)
      .filter((value) => value !== null);
    return `${dataset} ${matching.filter(Boolean).length}/${matching.length}`;
  });
  ui.reviewSummary.textContent = [state.listenerId, ...summary,
    allComplete ? '可以提交' : '仍有未评分片段'].join('，');
  ui.reviewChecks.replaceChildren();
  for (const dataset of CONFIG.datasets) {
    const start = state.trialIds.findIndex((id, index) => getTrial(index).dataset === dataset);
    const end = start + state.trialIds.filter((id, index) => getTrial(index).dataset === dataset).length;
    const completed = done.slice(start, end).filter(Boolean).length;
    const firstIncomplete = done.findIndex((isDone, index) => index >= start && index < end && !isDone);
    const row = document.createElement('button');
    row.type = 'button'; row.className = 'review-row';
    row.textContent = `${dataset}  ${completed} / ${end - start}  ${completed === end - start ? '已完成 ✓' : '继续评分'}`;
    row.addEventListener('click', () => { state.index = firstIncomplete === -1 ? start : firstIncomplete; save(); render(); });
    ui.reviewChecks.append(row);
  }
  ui.submit.disabled = !allComplete || Boolean(state.submittedAt);
  ui.download.hidden = !state.submittedAt;
  ui.submitError.textContent = state.submittedAt ? '提交成功，已保存本次记录。' : '';
}

function render() {
  ui.setup.hidden = Boolean(state);
  ui.study.hidden = !state || state.index === state.trialIds.length;
  ui.review.hidden = !state || state.index !== state.trialIds.length;
  if (ui.exportCurrent) ui.exportCurrent.disabled = !state;
  if (!state) return;
  if (state.index === state.trialIds.length) renderReview();
  else renderTrial();
}

function resultPayload({ forSubmission = false } = {}) {
  const timestamp = new Date().toISOString();
  const completeResults = state.trialIds.every((_, index) => complete(getTrial(index)));
  return {
    schema: 'se.subjective.mushra_style.v3', study: CONFIG.study,
    datasetVersion: manifest.dataset_version,
    audioVersion: manifest.audio_version, sessionId: state.sessionId,
    candidateIds, scale: { min: 0, max: 10, step: 0.1, uniquePerTrial: false },
    listenerId: state.listenerId, experience: state.experience, device: state.device,
    status: forSubmission ? 'submitted' : (completeResults ? 'complete' : 'in_progress'),
    exportedAt: timestamp,
    submittedAt: forSubmission ? timestamp : null,
    results: state.trialIds.map((_, index) => {
      const trial = getTrial(index);
      return { sample_id: trial.sample_id,
        order: candidates(trial).map((key) => candidateIds.indexOf(key)),
        scores: candidateIds.map((key) => state.scores[trial.sample_id]?.[key] ?? null) };
    }),
  };
}

function download(payload, suffix = '') {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `${CONFIG.downloadPrefix}${suffix}-${state.sessionId}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function formBody(type, payload) {
  const body = new FormData();
  body.append('type', type);
  body.append('study', payload.study);
  body.append('listenerId', payload.listenerId);
  body.append('sessionId', payload.sessionId);
  body.append('_subject', `Dereverb 听评 ${type} ${payload.listenerId}`);
  body.append('payloadJson', JSON.stringify(payload));
  return body;
}

async function submitProgress() {
  if (!state || ui.exportCurrent.disabled) return;
  const payload = resultPayload();
  payload.submissionKind = 'progress';
  ui.exportCurrent.disabled = true;
  ui.saveState.textContent = '正在提交当前进度';
  try {
    const response = await fetch(ENDPOINT, { method: 'POST', headers: {
      Accept: 'application/json',
    }, body: formBody(`${CONFIG.study}-progress`, payload) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    ui.saveState.textContent = '当前进度已提交';
  } catch (error) {
    download(payload, '-progress');
    ui.saveState.textContent = `提交失败（${error.message}），已下载进度备份`;
  } finally {
    ui.exportCurrent.disabled = false;
  }
}

async function submit() {
  if (!state.trialIds.every((_, index) => complete(getTrial(index)))) {
    ui.submitError.textContent = '请完成所有片段评分。'; return;
  }
  const payload = resultPayload({ forSubmission: true });
  ui.submit.disabled = true;
  ui.submitError.textContent = '提交中…';
  try {
    const response = await fetch(ENDPOINT, { method: 'POST', headers: {
      Accept: 'application/json',
    }, body: formBody(CONFIG.study, payload) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.submittedAt = payload.submittedAt;
    state.submittedPayload = payload;
    save(); renderReview();
  } catch (error) {
    ui.submitError.textContent = `提交失败（${error.message}）。已下载本地备份，请交给组织者。`;
    download(payload);
    ui.submit.disabled = false;
  }
}

async function init() {
  try {
    const response = await fetch('manifest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    manifest = await response.json();
    trials = orderedTrials(manifest, MODE);
    trialById = new Map(manifest.trials.map((trial) => [trial.sample_id, trial]));
    candidateIds = [...CANDIDATE_KEYS, ...manifest.models.map((model) => model.id)];
    ui.trialPicker.replaceChildren(...trials.map((trial, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${String(index + 1).padStart(3, '0')} · ${trial.dataset}`;
      return option;
    }));
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const expected = trials.map((trial) => trial.sample_id);
      if (parsed.study === CONFIG.study && parsed.trialIds?.length === expected.length
        && parsed.trialIds.every((id, index) => id === expected[index])) {
        state = parsed;
        const airVersion = manifest.audio_version?.AIR || 'original-v1';
        if (CONFIG.datasets.includes('AIR') && (state.airAudioVersion || 'original-v1') !== airVersion) {
          localStorage.setItem(`${STORAGE_KEY}:before-${airVersion}`, saved);
          const migration = migrateAirAudio(state, trials, airVersion);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          ui.audioUpdateNotice.textContent = MODE === 'joint'
            ? `AIR 音频已更新。ACE 的 56 条评分保持不变；${migration.removed} 条旧 AIR 评分已清除，请用新音频重新评分。`
            : `AIR 音频已更新；${migration.removed} 条旧评分已清除，请用新音频重新评分。`;
          ui.audioUpdateNotice.hidden = false;
        }
      }
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
  state = { study: CONFIG.study, sessionId: crypto.randomUUID(), listenerId,
    experience: ui.experience.value, device: ui.device.value, index: 0,
    trialIds: trials.map((trial) => trial.sample_id), scores: {},
    airAudioVersion: manifest.audio_version?.AIR || 'original-v1' };
  save(); render();
});
ui.trialPicker.addEventListener('change', () => {
  const index = Number(ui.trialPicker.value);
  const firstIncomplete = state.trialIds.findIndex((_, position) => !complete(getTrial(position)));
  if (!Number.isInteger(index) || index < 0
    || index > (firstIncomplete === -1 ? state.trialIds.length - 1 : firstIncomplete)) return;
  state.index = index; save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' });
});
ui.previous.addEventListener('click', () => { state.index -= 1; save(); render(); });
ui.next.addEventListener('click', () => {
  if (!complete(getTrial())) { ui.trialError.textContent = '请给本轮全部音频评分。'; return; }
  state.index += 1; save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('#back-to-trials').addEventListener('click', () => { state.index = state.trialIds.length - 1; save(); render(); });
ui.submit.addEventListener('click', submit);
ui.download.addEventListener('click', () => download(state.submittedPayload || resultPayload()));
if (ui.exportCurrent) ui.exportCurrent.addEventListener('click', submitProgress);
$('#reset').addEventListener('click', () => {
  if (!confirm('清除本机当前听评进度并重新开始？')) return;
  localStorage.removeItem(STORAGE_KEY); state = null; render();
});
document.addEventListener('play', (event) => { if (event.target instanceof HTMLAudioElement) pauseOtherAudio(event.target); }, true);
init();

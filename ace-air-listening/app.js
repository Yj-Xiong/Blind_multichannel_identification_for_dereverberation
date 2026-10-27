const ENDPOINT = 'https://formspree.io/f/mpqgvpvo';
const STORAGE_KEY = 'ace56-air30-joint-v2';
const CANDIDATE_KEYS = ['hidden_reference', 'lowpass_anchor', 'unprocessed'];
const $ = (selector) => document.querySelector(selector);
const ui = {
  setup: $('#setup'), study: $('#study'), review: $('#review'),
  listener: $('#listener-id'), experience: $('#experience'), device: $('#device'),
  setupError: $('#setup-error'), trialList: $('#trial-list'),
  trialPicker: $('#trial-picker'), aceProgress: $('#ace-progress'), airProgress: $('#air-progress'),
  trialKicker: $('#trial-kicker'), trialTitle: $('#trial-title'), trialMeta: $('#trial-meta'),
  progressLabel: $('#progress-label'),
  ratedCount: $('#rated-count'), reference: $('#reference-audio'), candidates: $('#candidate-list'),
  previous: $('#previous'), next: $('#next'), navProgress: $('#nav-progress'),
  trialError: $('#trial-error'), reviewSummary: $('#review-summary'),
  reviewChecks: $('#review-checks'), submitError: $('#submit-error'),
  submit: $('#submit'), download: $('#download'), saveState: $('#save-state'),
};
let manifest;
let state;
let trialById;
let candidateIds;

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

function orderedTrials() {
  const ace = manifest.trials.filter((trial) => trial.dataset === 'ACE');
  const air = manifest.trials.filter((trial) => trial.dataset === 'AIR');
  const scenes = [...new Set(ace.map((trial) => trial.scene_id))].sort();
  const bySceneAndSnr = new Map(ace.map((trial) => [`${trial.scene_id}:${trial.snr_db}`, trial]));
  if (scenes.length !== 14 || ace.length !== 56 || air.length !== 107
    || air.some((trial) => trial.snr_db !== 30)) throw new Error('ACE / AIR 样本清单不完整');
  const aceOrder = Array.from({ length: 7 }, (_, group) => [10, 20, 30, 40].flatMap((snr, snrIndex) => {
    const pair = ((group + snrIndex) % 7) * 2;
    return [scenes[pair], scenes[pair + 1]].map((scene) => bySceneAndSnr.get(`${scene}:${snr}`));
  })).flat();
  if (aceOrder.some((trial) => !trial)) throw new Error('ACE 样本清单缺少 SNR 条件');
  return [...aceOrder, ...air];
}

function candidates(trial) {
  return shuffle([...CANDIDATE_KEYS, ...manifest.models.map((model) => model.id)], hash(`${state.listenerId}:${trial.sample_id}`));
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  ui.saveState.textContent = '已保存在本机';
}

function getTrial(index = state.index) {
  return trialById.get(state.trialIds[index]);
}

function complete(trial) {
  return candidateIds.every((key) => Number.isInteger(state.scores[trial.sample_id]?.[key]));
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
    button.innerHTML = `<span class="trial-index">${String(index + 1).padStart(3, '0')}</span><span><strong>${trial.dataset}</strong><small>${trial.snr_db} dB SNR</small></span><span class="trial-check">${done[index] ? '✓' : ''}</span>`;
    button.addEventListener('click', () => { state.index = index; save(); render(); });
    ui.trialList.append(button);
  }
  Array.from(ui.trialPicker.options).forEach((option, index) => { option.disabled = index > maxNavigable; });
  ui.trialPicker.value = String(state.index);
  ui.progressLabel.textContent = `${done.filter(Boolean).length} / ${state.trialIds.length}`;
  ui.aceProgress.textContent = `${done.slice(0, 56).filter(Boolean).length} / 56`;
  ui.airProgress.textContent = `${done.slice(56).filter(Boolean).length} / 107`;
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
    if (raw === '') return;
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
  ui.next.textContent = state.index === state.trialIds.length - 1
    ? '检查并提交' : state.index === 55 ? '进入 AIR' : '下一条';
  ui.navProgress.textContent = `${state.index + 1} / ${state.trialIds.length}`;
  updateProgress();
}

function renderReview() {
  const done = state.trialIds.map((_, index) => complete(getTrial(index)));
  const allComplete = done.every(Boolean);
  ui.reviewSummary.textContent = `${state.listenerId} · ACE ${done.slice(0, 56).filter(Boolean).length}/56 · AIR ${done.slice(56).filter(Boolean).length}/107 · ${allComplete ? '可统一提交' : '仍有未评分片段'}`;
  ui.reviewChecks.replaceChildren();
  for (const [dataset, start, end] of [['ACE', 0, 56], ['AIR', 56, 163]]) {
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
  if (!state) return;
  if (state.index === state.trialIds.length) renderReview();
  else renderTrial();
}

function resultPayload() {
  return {
    schema: 'se.subjective.mushra_style.v2', study: manifest.study,
    datasetVersion: manifest.dataset_version, sessionId: state.sessionId,
    candidateIds,
    listenerId: state.listenerId, experience: state.experience, device: state.device,
    submittedAt: new Date().toISOString(),
    results: state.trialIds.map((_, index) => {
      const trial = getTrial(index);
      return { sample_id: trial.sample_id,
        order: candidates(trial).map((key) => candidateIds.indexOf(key)),
        scores: candidateIds.map((key) => state.scores[trial.sample_id][key]) };
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
    }, body: JSON.stringify({ type: 'ace56-air30-joint-v2', study: payload.study,
      listenerId: payload.listenerId, sessionId: payload.sessionId,
      payloadJson: JSON.stringify(payload) }) });
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
    const response = await fetch('manifest.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    manifest = await response.json();
    const trials = orderedTrials();
    trialById = new Map(manifest.trials.map((trial) => [trial.sample_id, trial]));
    candidateIds = [...CANDIDATE_KEYS, ...manifest.models.map((model) => model.id)];
    ui.trialPicker.replaceChildren(...trials.map((trial, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${String(index + 1).padStart(3, '0')} · ${trial.dataset} · ${trial.sample_id}`;
      return option;
    }));
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const expected = trials.map((trial) => trial.sample_id);
      if (parsed.study === manifest.study && parsed.trialIds?.length === expected.length
        && parsed.trialIds.every((id, index) => id === expected[index])) state = parsed;
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
  state = { study: manifest.study, sessionId: crypto.randomUUID(), listenerId,
    experience: ui.experience.value, device: ui.device.value, index: 0,
    trialIds: orderedTrials().map((trial) => trial.sample_id), scores: {} };
  save(); render();
});
ui.trialPicker.addEventListener('change', () => {
  const index = Number(ui.trialPicker.value);
  const firstIncomplete = state.trialIds.findIndex((_, position) => !complete(getTrial(position)));
  if (!Number.isInteger(index) || index < 0 || index > (firstIncomplete === -1 ? 162 : firstIncomplete)) return;
  state.index = index; save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' });
});
ui.previous.addEventListener('click', () => { state.index -= 1; save(); render(); });
ui.next.addEventListener('click', () => {
  if (!complete(getTrial())) { ui.trialError.textContent = '请给本轮全部样本评分。'; return; }
  state.index += 1; save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('#back-to-trials').addEventListener('click', () => { state.index = state.trialIds.length - 1; save(); render(); });
ui.submit.addEventListener('click', submit);
ui.download.addEventListener('click', () => download(state.submittedPayload || resultPayload()));
$('#reset').addEventListener('click', () => {
  if (!confirm('清除本机当前听评进度并重新开始？')) return;
  localStorage.removeItem(STORAGE_KEY); state = null; render();
});
document.addEventListener('play', (event) => { if (event.target instanceof HTMLAudioElement) pauseOtherAudio(event.target); }, true);
init();

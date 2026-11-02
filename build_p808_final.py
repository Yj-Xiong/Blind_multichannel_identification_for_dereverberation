#!/usr/bin/env python3
"""Build a self-contained short-batch listening page."""

import json
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "p808/short28_manifest.json"
OUTPUT = ROOT / "p808/index.html"


APP = r"""
(() => {
  const data = window.P808_DATA;
  const size = 7;
  const samplingVersion = 'listener-random-v5-short28-random-block-order';
  const scoringVersion = 'ovl-0-100-v1';
  const stagingEndpoint = window.P808_STAGING_ENDPOINT || '';
  const modelKeys = data.models.map((m) => m.id);
  function keysFor(trial) {
    return (trial.tracks.hidden_reference ? ['hidden_reference', 'unprocessed'] : ['unprocessed']).concat(modelKeys);
  }
  function sourceHash(trial) {
    return (trial.tracks.reference || trial.tracks.unprocessed).sha256;
  }
  function trialHasReference(id) { return Boolean(trials.get(id).tracks.reference); }
  const $ = (s) => document.querySelector(s);
  const ui = {
    setup: $('#setup'), study: $('#study'), listener: $('#listener'),
    experience: $('#experience'), device: $('#device'),
    start: $('#start'), error: $('#error'), progress: $('#progress'),
    sample: $('#sample'), reference: $('#reference'), candidates: $('#candidates'), guidance: $('#trial-guidance'),
    back: $('#back'), next: $('#next'), submit: $('#submit'), status: $('#status'),
    batch: $('#batch'), reset: $('#reset'), progressSubmit: $('#progress-submit')
  };
  let state = null;
  const trials = new Map(data.trials.map((t) => [t.sample_id, t]));

  function hash(value) {
    let h = 2166136261;
    for (const ch of value) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function shuffle(items, seed) {
    const out = [...items]; let value = seed || 1;
    for (let i = out.length - 1; i > 0; i -= 1) {
      value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
      const j = (value >>> 0) % (i + 1); [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function valid(v) { return typeof v === 'number' && v >= 0 && v <= 100 && Math.abs(v - Math.round(v)) < 1e-8; }
  function deviceType(value) { return value === 'headphones' ? 1 : value === 'speakers' ? 2 : 3; }
  function validUserId(value) { return /^[A-Za-z0-9\u3400-\u9fff]{1,20}$/.test(value); }
  function migrateScoreMap(map) {
    if (!map) return;
    Object.keys(map).forEach((sampleId) => {
      Object.keys(map[sampleId] || {}).forEach((key) => {
        if (typeof map[sampleId][key] === 'number' && map[sampleId][key] <= 10) map[sampleId][key] = Math.round(map[sampleId][key] * 10);
      });
    });
  }
  function save() { localStorage.setItem('p808-short28-v1:' + state.listener, JSON.stringify(state)); }
  function loadState(id) {
    try { return JSON.parse(localStorage.getItem('p808-short28-v1:' + id)); } catch { return null; }
  }
  function sampleOrder(listener) {
    const blocks = data.allocation_blocks;
    const weights = blocks.map((block) => block.reduce((sum, id) => sum + trials.get(id).allocation_weight, 0) / block.length);
    const total = weights.reduce((sum, value) => sum + value, 0);
    let value = ((hash('p808-block:' + listener + ':' + data.allocation_version) + 0.5) / 4294967296) * total;
    let first = weights.findIndex((weight) => (value -= weight) < 0);
    if (first < 0) first = blocks.length - 1;
    const remaining = shuffle(blocks.map((_, index) => index).filter((index) => index !== first),
      hash('p808-remaining-blocks:' + listener + ':' + data.allocation_version));
    const order = [];
    for (const [offset, blockIndex] of [first, ...remaining].entries()) {
      const block = blocks[blockIndex];
      order.push(...shuffle(block, hash('p808-within-block:' + listener + ':' + offset)));
    }
    return {order, firstBlock: first};
  }
  function pickBatch() {
    const ids = state.order.filter((id) => !state.used.includes(id));
    if (!ids.length) return false;
    state.round += 1; state.ids = ids.slice(0, size); state.index = 0; state.scores = {}; state.allScores = state.allScores || {}; state.submitted = false; state.completed = false; return true;
  }
  function orderedCandidates(trial) { return shuffle(keysFor(trial), hash(state.listener + ':' + trial.sample_id)); }
  function complete(trial) {
    const scores = orderedCandidates(trial).map((key) => (state.scores[trial.sample_id] || {})[key]);
    return scores.every(valid);
  }
  function trackUrl(file) { return file; }
  function setAudioSource(player, file) {
    player.pause();
    player.removeAttribute('src');
    player.load();
    player.src = trackUrl(file);
    player.load();
  }
  function card(trial, key, index) {
    const card = document.createElement('article'); card.className = 'candidate'; card.dataset.key = key;
    const head = document.createElement('div'); head.className = 'candidate-head';
    const title = document.createElement('strong'); title.textContent = '样本 ' + String.fromCharCode(65 + index);
    const value = document.createElement('span'); value.className = 'score-value';
    const old = (state.scores[trial.sample_id] || {})[key]; value.textContent = valid(old) ? old.toFixed(0) : '未评分';
    head.append(title, value);
    const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'none'; setAudioSource(audio, trial.tracks[key].file);
    const row = document.createElement('div'); row.className = 'score-row';
    const range = document.createElement('input'); range.type = 'range'; range.min = '0'; range.max = '100'; range.step = '1'; range.value = valid(old) ? old : '50';
    const number = document.createElement('input'); number.type = 'number'; number.min = '0'; number.max = '100'; number.step = '1'; number.value = valid(old) ? old : '';
    const update = (raw) => {
      if (raw === '') return; const n = Math.round(Number(raw));
      if (!valid(n)) return; state.scores[trial.sample_id] = state.scores[trial.sample_id] || {}; state.scores[trial.sample_id][key] = n;
      state.allScores = state.allScores || {}; state.allScores[trial.sample_id] = state.allScores[trial.sample_id] || {}; state.allScores[trial.sample_id][key] = n;
      range.value = n; number.value = n; value.textContent = n.toFixed(0); card.classList.add('rated'); save(); renderProgress();
    };
    range.addEventListener('input', () => update(range.value)); number.addEventListener('change', () => update(number.value));
    row.append(range, number); card.append(head, audio, row); return card;
  }
  function renderProgress() {
    const trial = trials.get(state.ids[state.index]); const scoreValues = orderedCandidates(trial).map((key) => (state.scores[trial.sample_id] || {})[key]).filter(valid);
    const completedCount = state.ids.filter((id) => complete(trials.get(id))).length;
    const hasScores = state.ids.some((id) => Object.values(state.scores[id] || {}).some(valid));
    const hasPendingStage = state.used.some((id) => !(state.stagedSampleIds || []).includes(id));
    ui.progress.textContent = complete(trial) ? '本条已完成' : '请给 ' + keysFor(trial).length + ' 段声音评分';
    ui.next.disabled = !complete(trial); ui.submit.disabled = !state.ids.every((id) => complete(trials.get(id)));
    ui.progressSubmit.hidden = (!hasScores && !hasPendingStage) || (completedCount >= state.ids.length && !hasPendingStage);
    ui.progressSubmit.textContent = !hasScores && hasPendingStage ? '补传已完成批次' : '提交当前进度';
    ui.progressSubmit.disabled = Boolean(state.submitting);
    ui.candidates.querySelectorAll('.candidate').forEach((node) => {
      const v = (state.scores[trial.sample_id] || {})[node.dataset.key];
      node.classList.remove('conflict');
    });
  }
  function render() {
    ui.setup.hidden = Boolean(state); ui.study.hidden = !state;
    if (!state) return;
    const finished = state.index >= state.ids.length;
    if (finished) {
      ui.batch.textContent = '第 ' + state.round + ' 批';
      ui.sample.textContent = state.completed ? '全部批次已完成' : '本批已完成，可以提交评分';
      ui.progress.textContent = state.completed ? '全部样本已提交' : '本批 ' + state.ids.length + ' 条均已评分';
      ui.reference.parentElement.hidden = true; ui.candidates.hidden = true;
      ui.back.hidden = false; ui.back.disabled = state.index === 0;
      ui.next.hidden = true;
      ui.progressSubmit.hidden = !state.used.some((id) => !(state.stagedSampleIds || []).includes(id));
      ui.progressSubmit.disabled = Boolean(state.submitting);
      ui.progressSubmit.textContent = '补传已完成批次';
      ui.submit.hidden = state.completed; ui.submit.disabled = state.completed;
      ui.submit.textContent = '提交本批并进入下一批';
      if (state.completed) ui.status.textContent = '所有样本都已完成。';
      else ui.status.textContent = '请提交本批评分，提交后自动进入下一批。';
      return;
    }
    ui.reference.parentElement.hidden = !trialHasReference(state.ids[state.index]); ui.candidates.hidden = false;
    ui.back.hidden = false; ui.next.hidden = false; ui.submit.hidden = true; ui.progressSubmit.hidden = true;
    ui.status.textContent = '';
    const trial = trials.get(state.ids[state.index]); ui.batch.textContent = '第 ' + state.round + ' 批';
    ui.sample.textContent = '当前批样本 ' + (state.index + 1) + ' / ' + state.ids.length;
    ui.guidance.textContent = trial.tracks.reference
      ? '先听上方参考语音，可反复播放；它不计分。下方 10 段中随机有一段与参考完全相同的隐藏参考，也要照常评分。'
      : '这条没有上方参考语音。请直接比较下方 9 段声音，按同一标准逐一评分。';
    if (trial.tracks.reference) setAudioSource(ui.reference, trial.tracks.reference.file);
    else { ui.reference.pause(); ui.reference.removeAttribute('src'); ui.reference.load(); }
    ui.candidates.innerHTML = '';
    orderedCandidates(trial).forEach((key, i) => ui.candidates.appendChild(card(trial, key, i)));
    ui.back.disabled = state.index === 0;
    ui.next.textContent = state.index === state.ids.length - 1 ? '提交本批并进入下一批' : '下一条';
    renderProgress();
  }
  function download(payload, suffix) {
    const name = 'p808-short28-' + state.listener + '-batch-' + state.round + (suffix || '');
    downloadFile(JSON.stringify(payload, null, 2), name + '.json', 'application/json');
    downloadFile(csvForPayload(payload), name + '.csv', 'text/csv;charset=utf-8');
  }
  function downloadFile(content, name, type) {
    const url = URL.createObjectURL(new Blob([content], {type: type}));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function csvCell(value) {
    let text = String(value == null ? '' : value);
    if (/^[\s]*[=+@-]/.test(text) && typeof value !== 'number') text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function csvForPayload(payload) {
    const columns = ['listener_id', 'session_id', 'task_id', 'round', 'submission_kind', 'submitted_at', 'dataset', 'sample_id', 'candidate_position', 'candidate_key', 'score', 'scale_max', 'audio_file', 'audio_url', 'audio_sha256', 'reference_file'];
    const lines = [columns.map(csvCell).join(',')];
    payload.sampleIds.forEach((sampleId) => {
      const trial = trials.get(sampleId);
      if (!trial) return;
      orderedCandidates(trial).forEach((key, index) => {
        const score = (payload.scores[sampleId] || {})[key];
        if (valid(score)) lines.push([payload.listenerId, payload.sessionId, payload.taskId, payload.round, payload.submissionKind,
          payload.submittedAt, trial.dataset, sampleId, index + 1, key, score, 100,
          trial.tracks[key].file, new URL(trial.tracks[key].file, location.href).href,
          trial.tracks[key].sha256, trial.tracks.reference ? trial.tracks.reference.file : ''].map(csvCell).join(','));
      });
    });
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
  }
  async function postSubmission(body) {
    const response = await fetch('https://formspree.io/f/mpqgvpvo', {
      method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json'},
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      const detail = (result.errors || []).map((item) => item.message).filter(Boolean).join('; ');
      throw new Error('HTTP ' + response.status + (detail ? ': ' + detail : ''));
    }
  }
  async function postStaging(payload) {
    if (!stagingEndpoint) throw new Error('暂存接口尚未配置');
    const staged = new Set(state.stagedSampleIds || []);
    const pending = state.used.filter((id) => !staged.has(id));
    const groups = [];
    for (let offset = 0; offset < pending.length; offset += size) {
      const ids = pending.slice(offset, offset + size);
      groups.push({ids, round: Math.floor(state.order.indexOf(ids[0]) / size) + 1, kind: 'batch'});
    }
    const current = state.ids.filter((id) => !state.used.includes(id) &&
      Object.values(state.scores[id] || {}).some(valid));
    if (current.length) groups.push({ids: current, round: state.round, kind: payload.submissionKind});
    for (const group of groups) {
      const form = new FormData();
      form.append('task_id', data.study);
      form.append('user_id', state.listener);
      form.append('device_type', String(deviceType(state.device)));
      form.append('scores_csv', csvForPayload({...payload, sampleIds: group.ids,
        round: group.round, submissionKind: group.kind}));
      const response = await fetch(stagingEndpoint, {
        method: 'POST', headers: {Accept: 'application/json'}, body: form
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        const detail = (result.errors || []).map((item) => item.message).filter(Boolean).join('; ');
        throw new Error('暂存接口 HTTP ' + response.status + (detail ? ': ' + detail : ''));
      }
      if (group.kind === 'batch') {
        state.stagedSampleIds = [...new Set([...(state.stagedSampleIds || []), ...group.ids])];
        save();
      }
    }
  }
  async function sendSubmission(type, payload) {
    const form = new FormData();
    form.append('type', type);
    form.append('payloadJson', JSON.stringify(payload));
    form.append('upload', new Blob([csvForPayload(payload)], {type: 'text/csv;charset=utf-8'}),
      'scores.csv');
    const response = await fetch('https://formspree.io/f/mpqgvpvo', {
      method: 'POST', headers: {Accept: 'application/json'}, body: form
    });
    if (response.ok) return 'attachment';
    const result = await response.json().catch(() => ({}));
    const detail = (result.errors || []).map((item) => item.message).filter(Boolean).join('; ')
      || result.error || '';
    if (response.status === 400 && /file uploads not permitted/i.test(detail)) {
      await postSubmission({type: type, payloadJson: JSON.stringify(payload)});
      return 'json';
    }
    throw new Error('HTTP ' + response.status + (detail ? ': ' + detail : ''));
  }
  function buildPayload(kind) {
    state.allScores = state.allScores || {};
    const completedIds = state.ids.filter((id) => complete(trials.get(id)));
    const scoredSampleIds = Object.keys(state.allScores).concat(Object.keys(state.scores || {}));
    const sampleIds = [...new Set([...state.used, ...completedIds, ...scoredSampleIds])];
    return {schema: 'se.subjective.p808_short_batch.v5', taskId: data.study, userId: state.listener,
      deviceType: deviceType(state.device), study: data.study, round: state.round,
      submissionKind: kind, scoringVersion: scoringVersion, scale: {min: 0, max: 100, step: 1, dimension: 'OVL', uniquePerTrial: false},
      dimensions: {SIG: '语音本身的声音质量', BAK: '回声和背景声音的干扰', OVL: '整体满意度'},
      samplingVersion: state.samplingVersion, sampleOrder: state.order, listenerId: state.listener,
      allocationVersion: state.allocationVersion,
      firstBlock: state.firstBlock,
      datasetVersion: data.dataset_version, audioVersion: data.audio_version,
      sessionId: state.sessionId,
      experience: state.experience, device: state.device, batchSize: state.ids.length, totalSize: sampleIds.length,
      sampleIds: sampleIds, scores: {...state.allScores, ...state.scores},
      completedSampleIds: completedIds, batchSampleIds: completedIds, batchScores: completedIds.reduce((out, id) => { out[id] = state.scores[id]; return out; }, {}),
      submittedAt: new Date().toISOString()};
  }
  async function submitProgress() {
    if (state.submitting) return;
    state.submitting = true; ui.progressSubmit.disabled = true;
    const payload = buildPayload('checkpoint');
    let message;
    try {
      await postStaging(payload);
      message = '当前进度已暂存，可以继续听测。';
    } catch (error) { download(payload, '-checkpoint'); message = '暂存失败（' + error.message + '），已下载当前进度备份；整批完成后可继续提交。'; }
    state.submitting = false; save();
    if (state.index >= state.ids.length) render(); else renderProgress();
    ui.status.textContent = message;
  }
  async function submit() {
    if (state.submitting) return;
    state.submitting = true; ui.next.disabled = true; ui.submit.disabled = true;
    const payload = buildPayload('batch');
    let stagingError = null;
    try { await postStaging(payload); } catch (error) { stagingError = error; }
    let notificationMode;
    try {
      notificationMode = await sendSubmission('dereverb-p808-short28-v1', payload);
      state.used.push(...state.ids); state.submitted = true;
    } catch (error) {
      download(payload, '-batch');
      ui.status.textContent = '提交失败（' + error.message + '），已下载备份，请重试本批。';
      state.submitting = false; ui.next.disabled = false; ui.submit.disabled = false;
      save(); return;
    }
    if (!pickBatch()) { state.completed = true; state.index = state.ids.length; }
    state.submitting = false;
    save(); render();
    if (stagingError) {
      download(payload, '-stage-backup');
      ui.status.textContent = '结果表单已接收整批，暂存失败（' + stagingError.message +
        '）；已下载备份。' + (notificationMode === 'json' ? '结果表单已回退到 JSON 提交。' : '');
    } else if (notificationMode === 'json') {
      download(payload, '-attachment-backup');
      ui.status.textContent = '原结果表单不支持附件，整批已按 JSON 提交；已下载 CSV 备份。';
    } else ui.status.textContent = '本批评分已被结果表单接收。';
  }
  ui.start.addEventListener('click', () => {
    const id = ui.listener.value.trim(); if (!validUserId(id)) { ui.error.textContent = '请输入 1–20 位中英文或数字测试 ID。'; return; }
    state = loadState(id) || {listener: id, experience: ui.experience.value, device: ui.device.value,
      round: 0, index: 0, ids: [], scores: {}, allScores: {}, used: [],
      stagedSampleIds: [], submitted: false, completed: false};
    if (!state.sessionId) state.sessionId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    if (state.scoringVersion !== scoringVersion) {
      migrateScoreMap(state.scores);
      migrateScoreMap(state.allScores);
      state.scoringVersion = scoringVersion;
    }
    if (!Array.isArray(state.order) || state.order.length !== data.trials.length
      || state.samplingVersion !== samplingVersion) {
      const allocation = sampleOrder(id);
      state.order = allocation.order;
      state.firstBlock = allocation.firstBlock;
      state.samplingVersion = samplingVersion;
      state.allocationVersion = data.allocation_version;
    }
    state.allScores = {...(state.allScores || {}), ...(state.scores || {})};
    state.completed = Boolean(state.completed);
    if (state.completed) { save(); render(); return; }
    if (!state.ids.length || state.submitted) { if (!pickBatch()) { ui.error.textContent = '所有样本都已完成。'; return; } }
    save(); render();
  });
  ui.next.addEventListener('click', () => {
    if (!complete(trials.get(state.ids[state.index]))) return;
    if (state.index === state.ids.length - 1) { submit(); return; }
    state.index += 1; save(); render();
  });
  ui.progressSubmit.addEventListener('click', submitProgress);
  ui.back.addEventListener('click', () => { state.index -= 1; save(); render(); });
  ui.submit.addEventListener('click', submit);
  ui.reset.addEventListener('click', () => { if (state) localStorage.removeItem('p808-short28-v1:' + state.listener); state = null; render(); });
  document.addEventListener('play', (e) => { if (e.target instanceof HTMLAudioElement) document.querySelectorAll('audio').forEach((a) => { if (a !== e.target) a.pause(); }); }, true);
  window.addEventListener('error', (e) => { ui.error.textContent = '页面脚本错误：' + e.message; });
})();
"""


def main():
    source = json.loads(SOURCE.read_text())
    assert len(source["trials"]) == 28
    source["sample_count"] = len(source["trials"])
    staging_endpoint = os.environ.get("P808_STAGING_ENDPOINT", "https://formspree.io/f/mjyypvzy")
    style = (ROOT / "p808-batch/styles.css").read_text()
    html = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dereverb 短批次听评</title><style>""" + style + """
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}body{overflow-x:hidden}.topbar{padding:0 16px}.short-main{width:100%}audio,input,select,button{max-width:100%}
.short-main{max-width:1200px;margin:0 auto;padding:28px 20px 70px}.short-setup{max-width:900px;margin:5vh auto}
.short-setup h1{font-size:32px}.short-setup p{line-height:1.7;color:#526662}.short-form{display:grid;grid-template-columns:1.5fr 1fr 1fr auto;gap:12px;align-items:end}
.short-form label{display:grid;gap:6px;font-size:13px;font-weight:700}.short-form input,.short-form select{height:40px;padding:0 10px;border:1px solid #bfcfcb;border-radius:5px;background:#fff}
.short-form button{height:40px;padding:0 18px;border:0;border-radius:5px;background:#087a70;color:#fff;font-weight:700}
.short-study{max-width:1200px;margin:0 auto}.short-head{display:flex;justify-content:space-between;border-bottom:1px solid #d4dfdc;padding-bottom:14px}
.short-head h2{margin:0}.short-reference{display:grid;grid-template-columns:1fr 45%;gap:16px;padding:15px;margin:18px 0;border:1px solid #b9d8d1;background:#edf7f3;border-radius:5px}
.short-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.short-card{padding:14px;border:1px solid #d1dcda;border-radius:6px;background:#fff}
.short-card.conflict{border-color:#ba5144;background:#fff8f6}.short-card audio{width:100%;margin:10px 0}.short-card-head{display:flex;justify-content:space-between}
.short-reference strong{display:block}.short-reference span{display:block;margin-top:3px;color:#56736d;font-size:12px}
.evaluation-guidance{margin:20px 0;padding:14px 16px;border:1px solid #b9d8d1;border-left:4px solid #087a70;border-radius:5px;background:#edf7f3;color:#385650;font-size:13px;line-height:1.7}
.evaluation-guidance strong{display:block;margin-bottom:4px;color:#175f57;font-size:14px}
.evaluation-guidance p{margin:0;color:#385650}
.evaluation-guidance p + p{margin-top:8px}
.evaluation-guidance b{color:#244a44}
.short-score{display:grid;grid-template-columns:1fr 64px;gap:10px}.short-score input{width:100%}.short-nav{display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding-top:14px;border-top:1px solid #d4dfdc}
.short-nav button{padding:9px 15px;border:1px solid #cad7d4;border-radius:5px;background:#fff}.short-nav button:last-child{background:#087a70;color:#fff}.short-error{color:#b34332;min-height:22px}
@media(max-width:700px){.topbar{padding-left:14px;padding-right:14px;padding-inline:14px}.brand{min-width:0}.brand>span:nth-child(2){overflow:hidden;text-overflow:ellipsis}.topbar .quiet{padding-left:9px;padding-right:9px;padding-inline:9px;white-space:nowrap}.short-main{padding-left:14px;padding-right:14px;padding-inline:14px}.short-form,.short-reference{display:grid;grid-template-columns:1fr}.short-cards{grid-template-columns:1fr}.short-nav{gap:8px}.short-nav button{min-height:42px;padding-left:10px;padding-right:10px;padding-inline:10px}}
</style></head><body>
<header class="topbar"><div class="brand"><span class="brand-mark"><img src="center-logo.png" alt="苏州大学听觉与语言智能中心"></span><span>Dereverb 短批次听评</span><span class="version">v3</span></div><button id="reset" class="quiet">重新开始</button></header>
<main class="short-main"><section id="setup" class="short-setup"><p class="eyebrow">短批次主观评估</p><h1>每批 7 条，共 28 条</h1>
<p>本页包含 ACE 和 AIR 的配对样本。每个测试 ID 独立随机生成四批顺序；同一测试 ID 可以回来继续下一批，已经完成的样本不会再次出现。请为每段声音给出一个符合听感的分数。</p>
<div class="study-facts"><div><strong>7</strong><span>每批样本</span></div><div><strong>28</strong><span>全部样本</span></div><div><strong>10</strong><span>每条评分声音</span></div><div><strong>4</strong><span>完成全部批次</span></div></div>
<section class="evaluation-guidance" aria-label="评分说明"><strong>我们要评什么</strong><p>请听说话声音是否清楚完整，以及回声和背景噪声是否明显，再给每段声音一个 0–100 分的总体分。上方参考语音可反复播放但不计分；下方 10 段声音都要评分，其中随机包含一段与参考相同的隐藏参考。<b>80–100：</b>整体清楚，回声和噪声很小；<b>60–79：</b>有一点问题但容易听清；<b>40–59：</b>问题明显但多数能听清；<b>20–39：</b>回声或失真较重；<b>0–19：</b>听清说话很费力。</p></section>
<section class="scoring-rules"><h2>评分规则</h2><ol><li>先听上方参考语音，再评下面 10 段；参考语音不计分。</li><li>按 0–100 分、每 1 分一个档位给出总体分，同时考虑说话是否清楚完整，以及回声和背景声音是否残留。</li><li>每段声音都要评分；相同分数可以使用。完成当前一批后再提交整批结果。</li></ol></section>
<div class="short-form"><label>测试 ID<input id="listener" placeholder="name 或 name_YYYYMMDD"></label><label>听评经验<select id="experience"><option value="general">普通听众</option><option value="experienced">有语音处理经验</option><option value="expert">领域专家</option></select></label><label>收听设备<select id="device"><option value="headphones">耳机</option><option value="speakers">扬声器</option><option value="other">其他</option></select></label><button id="start">开始听测</button></div><p>每个测试 ID 独立随机排列 28 条样本，每批 7 条；可随时保存当前进度，同一 ID 返回时继续未完成批次。已完成样本不会重复；进度保存在本机浏览器。建议用耳机并保持相同音量。</p><p id="error" class="short-error"></p></section>
<section id="study" class="short-study" hidden><div class="short-head"><div><p id="batch" class="eyebrow"></p><h2 id="sample"></h2></div><strong id="progress"></strong></div>
<section class="evaluation-guidance" aria-label="评分提示"><strong>评分提示</strong>
<p><b>先听说话声：</b>字音是否清楚、完整、连贯，有没有变闷、失真或断续。<b>再听环境声：</b>说话后是否拖着回声，背景噪声是否明显。两方面一起考虑，给每段声音一个 0–100 分的总体分；说话越清楚完整、回声和噪声越少，分数越高。</p>
<p><b>分数参考：</b>80–100 分，清楚完整，回声和噪声很小；60–79 分，有轻微问题但容易听清；40–59 分，问题明显，部分字音受影响；20–39 分，回声、噪声或失真较重；0–19 分，听清说话很费力。</p>
<p id="trial-guidance"></p><p>下方每段声音都要评分；可以给不同声音相同分数。</p></section>
<div class="short-reference"><div><strong>参考语音</strong><span>可反复播放，不计入评分</span></div><audio id="reference" controls preload="none"></audio></div><div id="candidates" class="short-cards"></div>
<p id="status" class="short-error"></p><div class="short-nav"><button id="back">上一条</button><button id="progress-submit" hidden>提交当前进度</button><button id="next">下一条</button><button id="submit" hidden>提交本批并进入下一批</button></div></section></main>
<script>window.P808_DATA=""" + json.dumps(source, ensure_ascii=False, separators=(",", ":")) + ";window.P808_STAGING_ENDPOINT=" + json.dumps(staging_endpoint) + ";</script><script>""" + APP + """</script></body></html>"""
    OUTPUT.write_text(html)
    print(OUTPUT, OUTPUT.stat().st_size)


if __name__ == "__main__":
    main()

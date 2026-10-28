#!/usr/bin/env python3
"""Build a self-contained short-batch listening page."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "p808/batch_manifest.json"
INDEX = ROOT / "p808-batch/batch_index.json"
OUTPUT = ROOT / "p808/index.html"


APP = r"""
(() => {
  const data = window.P808_DATA;
  const size = 15;
  const keys = ['hidden_reference', 'unprocessed'].concat(data.models.map((m) => m.id));
  const $ = (s) => document.querySelector(s);
  const ui = {
    setup: $('#setup'), study: $('#study'), listener: $('#listener'),
    experience: $('#experience'), device: $('#device'),
    start: $('#start'), error: $('#error'), progress: $('#progress'),
    sample: $('#sample'), reference: $('#reference'), candidates: $('#candidates'),
    back: $('#back'), next: $('#next'), submit: $('#submit'), status: $('#status'),
    batch: $('#batch'), reset: $('#reset')
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
  function valid(v) { return typeof v === 'number' && v >= 0 && v <= 10 && Math.abs(v * 10 - Math.round(v * 10)) < 1e-8; }
  function save() { localStorage.setItem('p808-final:' + state.listener, JSON.stringify(state)); }
  function loadState(id) {
    try { return JSON.parse(localStorage.getItem('p808-final:' + id)); } catch { return null; }
  }
  function pickBatch() {
    const ids = (data.batches[state.round] || []).filter((id) => !state.used.includes(id));
    if (!ids.length) return false;
    state.round += 1; state.ids = ids.slice(0, size); state.index = 0; state.scores = {}; state.allScores ||= {}; state.submitted = false; state.completed = false; return true;
  }
  function orderedCandidates(trial) { return shuffle(keys, hash(state.listener + ':' + trial.sample_id)); }
  function complete(trial) {
    const scores = orderedCandidates(trial).map((key) => state.scores[trial.sample_id]?.[key]);
    return scores.every(valid) && new Set(scores.map((v) => v.toFixed(1))).size === scores.length;
  }
  function trackUrl(file) { return file; }
  function card(trial, key, index) {
    const card = document.createElement('article'); card.className = 'candidate'; card.dataset.key = key;
    const head = document.createElement('div'); head.className = 'candidate-head';
    const title = document.createElement('strong'); title.textContent = '样本 ' + String.fromCharCode(65 + index);
    const value = document.createElement('span'); value.className = 'score-value';
    const old = state.scores[trial.sample_id]?.[key]; value.textContent = valid(old) ? old.toFixed(1) : '未评分';
    head.append(title, value);
    const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'none'; audio.src = trackUrl(trial.tracks[key].file);
    const row = document.createElement('div'); row.className = 'score-row';
    const range = document.createElement('input'); range.type = 'range'; range.min = '0'; range.max = '10'; range.step = '0.1'; range.value = valid(old) ? old : '5';
    const number = document.createElement('input'); number.type = 'number'; number.min = '0'; number.max = '10'; number.step = '0.1'; number.value = valid(old) ? old : '';
    const update = (raw) => {
      if (raw === '') return; const n = Math.round(Number(raw) * 10) / 10;
      if (!valid(n)) return; state.scores[trial.sample_id] ||= {}; state.scores[trial.sample_id][key] = n;
      state.allScores ||= {}; state.allScores[trial.sample_id] ||= {}; state.allScores[trial.sample_id][key] = n;
      range.value = n; number.value = n; value.textContent = n.toFixed(1); card.classList.add('rated'); save(); renderProgress();
    };
    range.addEventListener('input', () => update(range.value)); number.addEventListener('change', () => update(number.value));
    row.append(range, number); card.append(head, audio, row); return card;
  }
  function renderProgress() {
    const trial = trials.get(state.ids[state.index]); const scoreValues = orderedCandidates(trial).map((key) => state.scores[trial.sample_id]?.[key]).filter(valid);
    const duplicated = new Set(scoreValues.map((v) => v.toFixed(1))).size !== scoreValues.length;
    ui.progress.textContent = (complete(trial) ? '本条已完成' : '请给 10 个样本评分') + (duplicated ? '，不能同分' : '');
    ui.next.disabled = !complete(trial); ui.submit.disabled = !state.ids.every((id) => complete(trials.get(id)));
    ui.candidates.querySelectorAll('.candidate').forEach((node) => {
      const v = state.scores[trial.sample_id]?.[node.dataset.key];
      node.classList.toggle('conflict', valid(v) && scoreValues.filter((x) => x.toFixed(1) === v.toFixed(1)).length > 1);
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
      ui.next.hidden = true; ui.submit.hidden = state.completed; ui.submit.disabled = state.completed;
      ui.submit.textContent = '提交本批并进入下一批';
      if (state.completed) ui.status.textContent = '所有样本都已完成。';
      else ui.status.textContent = '请提交本批评分，提交后自动进入下一批。';
      return;
    }
    ui.reference.parentElement.hidden = false; ui.candidates.hidden = false;
    ui.back.hidden = false; ui.next.hidden = false; ui.submit.hidden = true;
    ui.status.textContent = '';
    const trial = trials.get(state.ids[state.index]); ui.batch.textContent = '第 ' + state.round + ' 批';
    ui.sample.textContent = trial.dataset + '  第 ' + (state.index + 1) + ' / ' + state.ids.length + ' 条';
    ui.reference.src = trackUrl(trial.tracks.reference.file);
    ui.candidates.replaceChildren(...orderedCandidates(trial).map((key, i) => card(trial, key, i)));
    ui.back.disabled = state.index === 0;
    ui.next.textContent = state.index === state.ids.length - 1 ? '提交本批并进入下一批' : '下一条';
    renderProgress();
  }
  function download(payload) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = 'p808-short-' + state.listener + '-batch-' + state.round + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function submit() {
    if (state.submitting) return;
    state.submitting = true; ui.next.disabled = true; ui.submit.disabled = true;
    state.allScores ||= {};
    const cumulativeScores = {...state.allScores, ...state.scores};
    const cumulativeSampleIds = [...new Set([...state.used, ...state.ids])];
    const payload = {schema: 'se.subjective.p808_short_batch.v3', study: data.study, round: state.round, listenerId: state.listener,
      experience: state.experience, device: state.device, batchSize: state.ids.length, totalSize: cumulativeSampleIds.length,
      sampleIds: cumulativeSampleIds, scores: cumulativeScores, batchSampleIds: state.ids, batchScores: state.scores,
      submittedAt: new Date().toISOString()};
    try {
      const response = await fetch('https://formspree.io/f/mpqgvpvo', {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json'}, body: JSON.stringify({type: 'dereverb-p808-short-v3', payloadJson: JSON.stringify(payload)})});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      state.used.push(...state.ids); state.submitted = true;
    } catch (error) { download(payload); state.used.push(...state.ids); state.submitted = true; }
    if (!pickBatch()) { state.completed = true; state.index = state.ids.length; }
    state.submitting = false;
    save(); render();
  }
  ui.start.addEventListener('click', () => {
    const id = ui.listener.value.trim(); if (!id) { ui.error.textContent = '请输入测试 ID。'; return; }
    state = loadState(id) || {listener: id, experience: ui.experience.value, device: ui.device.value,
      round: 0, index: 0, ids: [], scores: {}, allScores: {}, used: [], submitted: false, completed: false};
    state.allScores = {...(state.allScores || {}), ...(state.scores || {})};
    state.completed = Boolean(state.completed);
    if (!state.ids.length || state.submitted) { if (!pickBatch()) { ui.error.textContent = '所有样本都已完成。'; return; } }
    save(); render();
  });
  ui.next.addEventListener('click', () => {
    if (!complete(trials.get(state.ids[state.index]))) return;
    if (state.index === state.ids.length - 1) { submit(); return; }
    state.index += 1; save(); render();
  });
  ui.back.addEventListener('click', () => { state.index -= 1; save(); render(); });
  ui.submit.addEventListener('click', submit);
  ui.reset.addEventListener('click', () => { if (state) localStorage.removeItem('p808-final:' + state.listener); state = null; render(); });
  document.addEventListener('play', (e) => { if (e.target instanceof HTMLAudioElement) document.querySelectorAll('audio').forEach((a) => { if (a !== e.target) a.pause(); }); }, true);
  window.addEventListener('error', (e) => { ui.error.textContent = '页面脚本错误：' + e.message; });
})();
"""


def main():
    source = json.loads(SOURCE.read_text())
    index = json.loads(INDEX.read_text())
    source["batches"] = index["batches"]
    source["sample_count"] = index["sample_count"]
    style = (ROOT / "p808-batch/styles.css").read_text()
    html = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dereverb 短批次听评</title><style>""" + style + """
.short-main{max-width:1200px;margin:0 auto;padding:28px 20px 70px}.short-setup{max-width:900px;margin:5vh auto}
.short-setup h1{font-size:32px}.short-setup p{line-height:1.7;color:#526662}.short-form{display:grid;grid-template-columns:1.5fr 1fr 1fr auto;gap:12px;align-items:end}
.short-form label{display:grid;gap:6px;font-size:13px;font-weight:700}.short-form input,.short-form select{height:40px;padding:0 10px;border:1px solid #bfcfcb;border-radius:5px;background:#fff}
.short-form button{height:40px;padding:0 18px;border:0;border-radius:5px;background:#087a70;color:#fff;font-weight:700}
.short-study{max-width:1200px;margin:0 auto}.short-head{display:flex;justify-content:space-between;border-bottom:1px solid #d4dfdc;padding-bottom:14px}
.short-head h2{margin:0}.short-reference{display:grid;grid-template-columns:1fr 45%;gap:16px;padding:15px;margin:18px 0;border:1px solid #b9d8d1;background:#edf7f3;border-radius:5px}
.short-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.short-card{padding:14px;border:1px solid #d1dcda;border-radius:6px;background:#fff}
.short-card.conflict{border-color:#ba5144;background:#fff8f6}.short-card audio{width:100%;margin:10px 0}.short-card-head{display:flex;justify-content:space-between}
.short-reference strong{display:block}.short-reference span{display:block;margin-top:3px;color:#56736d;font-size:12px}
.short-score{display:grid;grid-template-columns:1fr 64px;gap:10px}.short-score input{width:100%}.short-nav{display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding-top:14px;border-top:1px solid #d4dfdc}
.short-nav button{padding:9px 15px;border:1px solid #cad7d4;border-radius:5px;background:#fff}.short-nav button:last-child{background:#087a70;color:#fff}.short-error{color:#b34332;min-height:22px}
@media(max-width:700px){.short-form,.short-reference{display:grid;grid-template-columns:1fr}.short-cards{grid-template-columns:1fr}}
</style></head><body>
<header class="topbar"><div class="brand"><span class="brand-mark"><img src="center-logo.png" alt="苏州大学听觉与语言智能中心"></span><span>Dereverb 短批次听评</span><span class="version">v2</span></div><button id="reset" class="quiet">重新开始</button></header>
<main class="short-main"><section id="setup" class="short-setup"><p class="eyebrow">短批次主观评估</p><h1>每批 15 条，完成即可提交</h1>
<p>同一测试 ID 可以回来继续下一批；已经完成的样本不会再次出现。每个样本的 10 个评分项必须使用不同分数，形成明确排序。</p>
<div class="study-facts"><div><strong>15</strong><span>每批样本</span></div><div><strong>163</strong><span>可抽取样本</span></div><div><strong>10</strong><span>每个样本的评分项</span></div><div><strong>1</strong><span>每批独立提交</span></div></div>
<section class="scoring-rules"><h2>评分规则</h2><ol><li>每批先听公开参考；每个样本包含 8 个模型结果、1 个隐藏参考和 1 个未处理输入。</li><li>按 0.0–10.0 分、每 0.1 分一个档位评分；混响、噪声和处理伪影越明显，分数应越低。</li><li>每个样本的 10 个评分项必须全部使用不同分数，形成明确排序；完成一批即可提交。</li></ol></section>
<div class="short-form"><label>测试 ID<input id="listener" placeholder="name 或 name_YYYYMMDD"></label><label>听评经验<select id="experience"><option value="general">普通听众</option><option value="experienced">有语音处理经验</option><option value="expert">领域专家</option></select></label><label>收听设备<select id="device"><option value="headphones">耳机</option><option value="speakers">扬声器</option><option value="other">其他</option></select></label><button id="start">开始听测</button></div><p>完成一批即可提交；同一测试 ID 返回时会继续未完成批次或领取下一批。每次提交会保留该测试 ID 的累计结果。进度保存在本机浏览器，建议使用耳机并保持相同音量。</p><p id="error" class="short-error"></p></section>
<section id="study" class="short-study" hidden><div class="short-head"><div><p id="batch" class="eyebrow"></p><h2 id="sample"></h2></div><strong id="progress"></strong></div>
<div class="short-reference"><div><strong>参考语音</strong><span>可反复播放，不计入评分</span></div><audio id="reference" controls preload="none"></audio></div><div id="candidates" class="short-cards"></div>
<p id="status" class="short-error"></p><div class="short-nav"><button id="back">上一条</button><button id="next">下一条</button><button id="submit" hidden>提交本批并进入下一批</button></div></section></main>
<script>window.P808_DATA=""" + json.dumps(source, ensure_ascii=False, separators=(",", ":")) + """;</script><script>""" + APP + """</script></body></html>"""
    OUTPUT.write_text(html)
    print(OUTPUT, OUTPUT.stat().st_size)


if __name__ == "__main__":
    main()

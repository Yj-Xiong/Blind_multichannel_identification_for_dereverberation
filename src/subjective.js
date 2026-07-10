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
const NEUTRAL_SCORE = 3;
const STORAGE_KEY = 'nc2026-subjective-listener-v2';

const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
const state = {
  manifest: null,
  scores: saved.scores || {},
  listenerId: saved.listenerId || '',
  sessionNote: saved.sessionNote || '',
  filters: {
    snr: 'all',
    branch: 'all',
    method: '',
  },
};

const els = {
  content: document.querySelector('#subjective-content'),
  snr: document.querySelector('#snr-filter'),
  method: document.querySelector('#method-filter'),
  reset: document.querySelector('#reset-scores'),
  listenerId: document.querySelector('#listener-id'),
  sessionNote: document.querySelector('#session-note'),
  exportScores: document.querySelector('#export-scores'),
  submitStatus: document.querySelector('#submit-status'),
};

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    listenerId: state.listenerId,
    sessionNote: state.sessionNote,
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

  const label = document.createElement('label');
  label.textContent = 'Score';
  label.htmlFor = `score-${id}`;

  const input = document.createElement('input');
  input.type = 'range';
  input.min = '1';
  input.max = '5';
  input.step = '0.5';
  input.id = `score-${id}`;
  input.value = state.scores[id] ?? NEUTRAL_SCORE;

  const value = document.createElement('output');
  value.textContent = Number(input.value).toFixed(1);

  input.addEventListener('input', () => {
    value.textContent = Number(input.value).toFixed(1);
    state.scores[id] = Number(input.value);
    saveState();
  });

  wrapper.append(label, input, value);
  return wrapper;
}

function renderCard(entry) {
  const item = findItem(entry, entry.method);
  const card = document.createElement('article');
  card.className = 'subjective-card neutral';

  const title = document.createElement('div');
  title.className = 'subjective-card-title';
  title.innerHTML = `<h4>${entry.method.label}</h4>`;

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
    els.content.innerHTML = '<p class="empty">No subjective examples match the current filters.</p>';
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
        <span>${entries.length} examples</span>
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
    method: entry.method.label,
    branch: entry.branch,
    branchLabel: branchLabel(entry.branch),
    snr: entry.snr,
    lambda: entry.lambda,
    score: Number(state.scores[entryId(entry)] ?? NEUTRAL_SCORE),
  }));

  return {
    type: 'nc2026-subjective-scores',
    version: 1,
    exportedAt: new Date().toISOString(),
    listenerId: state.listenerId || 'anonymous',
    sessionNote: state.sessionNote || '',
    defaultScore: NEUTRAL_SCORE,
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

async function submitScores() {
  const data = buildExportData();
  els.submitStatus.textContent = 'Submitting...';
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
        scoreCount: data.scores.length,
        scoresJson: JSON.stringify(data.scores),
        payloadJson: JSON.stringify(data),
      }),
    });

    if (!response.ok) throw new Error('Submission failed.');
    els.submitStatus.textContent = 'Submitted successfully. Thank you!';
    els.submitStatus.classList.add('success');
  } catch (error) {
    els.submitStatus.textContent = 'Submission failed. A backup JSON file has been downloaded; please send it to the organizers.';
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

  els.listenerId.value = state.listenerId;
  els.sessionNote.value = state.sessionNote;

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
  els.method.addEventListener('input', () => {
    state.filters.method = els.method.value.trim().toLowerCase();
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

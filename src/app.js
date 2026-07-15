import { clearVisualization, renderSpectrogram, renderWaveform } from './audio-visualizer.js';

const CATEGORY_LABELS = {
  comparison: '10-30 dB Comparison',
  snr5: '5 dB Ablation',
};

const MAIN_DEMO_GROUPS = new Set(['sim1024_rho0.1', 'wpe_gwpe_noisy']);
const HIDDEN_PROCESSINGS = new Set(['specsub_mics']);

const BRANCH_LABELS = {
  noisy: 'Noisy input',
  specsub: 'Spectral-subtraction input',
  reference: 'Inputs',
};

const TOP_BRANCH_LABELS = {
  source: 'Clean source',
  noisy: 'Noisy microphones',
  specsub: 'Spectral-subtraction noisy',
};

const state = {
  manifest: null,
  filters: {
    group: 'all',
    snr: 'all',
    processing: 'all',
    search: '',
  },
};

const els = {
  summary: document.querySelector('#summary'),
  filters: document.querySelector('#filters'),
  content: document.querySelector('#content'),
  status: document.querySelector('#status'),
  nav: null,
};

function slugify(value) {
  return value.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function uniqueId(prefix, parts) {
  return `${prefix}-${parts.map(slugify).join('-')}`;
}

function unique(items, key) {
  return [...new Set(items.map(item => item[key]).filter(value => value !== null && value !== undefined))];
}

function groupBy(items, keyFn) {
  return items.reduce((map, item) => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());
}

function makeOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function visibleItems() {
  return state.manifest.items.filter(item => MAIN_DEMO_GROUPS.has(item.group) && !HIDDEN_PROCESSINGS.has(item.processing));
}

function experimentCategory(item) {
  return item.snr === 5 ? 'snr5' : 'comparison';
}

function renderSummary() {
  const items = visibleItems();
  const comparisonCount = items.filter(item => experimentCategory(item) === 'comparison').length;
  const snr5Count = items.filter(item => experimentCategory(item) === 'snr5').length;
  const wpeCount = items.filter(item => item.group === 'wpe_gwpe_noisy').length;
  els.summary.innerHTML = `
    <div class="summary-card"><strong>${items.length}</strong><span>Total example count</span></div>
    <div class="summary-card"><strong>${comparisonCount}</strong><span>Comparison</span></div>
    <div class="summary-card"><strong>${snr5Count}</strong><span>5 dB Ablation</span></div>
    <div class="summary-card"><strong>${wpeCount}</strong><span>WPE / GWPE examples</span></div>
  `;
}

function renderFilters() {
  const items = visibleItems();
  els.filters.innerHTML = '';

  const categorySelect = document.createElement('select');
  categorySelect.id = 'category-filter';
  categorySelect.append(makeOption('all', 'All experiments'));
  for (const category of ['comparison', 'snr5']) {
    categorySelect.append(makeOption(category, CATEGORY_LABELS[category]));
  }

  const snrSelect = document.createElement('select');
  snrSelect.id = 'snr-filter';
  snrSelect.append(makeOption('all', 'All SNRs'));
  for (const snr of unique(items, 'snr').sort((a, b) => b - a)) {
    snrSelect.append(makeOption(String(snr), `SNR ${snr} dB`));
  }

  const processingSelect = document.createElement('select');
  processingSelect.id = 'processing-filter';
  processingSelect.append(makeOption('all', 'All conditions'));
  const processingLabels = {
    source: 'Clean source',
    noisy_mics: 'Noisy mics',
    norm_noisy_mics: 'Normalized noisy mics',
    specsub_mics: 'SpecSub mics',
    Noisy: 'Noisy input',
    SpecSub: 'SpecSub input',
    unknown: 'Unknown',
  };
  for (const processing of unique(items, 'processing')) {
    processingSelect.append(makeOption(processing, processingLabels[processing] || processing));
  }

  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search method, e.g. MINT, ELp, GWPE';
  search.id = 'search-filter';

  const controls = [
    ['Experiment', categorySelect],
    ['SNR', snrSelect],
    ['Condition', processingSelect],
    ['Method search', search],
  ];

  for (const [label, control] of controls) {
    const wrapper = document.createElement('label');
    wrapper.className = 'filter-control';
    wrapper.append(document.createElement('span'));
    wrapper.querySelector('span').textContent = label;
    wrapper.append(control);
    els.filters.append(wrapper);
  }
  els.status.classList.add('filter-status');
  els.filters.append(els.status);

  categorySelect.addEventListener('change', () => {
    state.filters.group = categorySelect.value;
    renderContent();
  });
  snrSelect.addEventListener('change', () => {
    state.filters.snr = snrSelect.value;
    renderContent();
  });
  processingSelect.addEventListener('change', () => {
    state.filters.processing = processingSelect.value;
    renderContent();
  });
  search.addEventListener('input', () => {
    state.filters.search = search.value.trim().toLowerCase();
    renderContent();
  });
}

function filterItems(items) {
  const { group, snr, processing, search } = state.filters;
  return items.filter(item => {
    if (group !== 'all' && experimentCategory(item) !== group) return false;
    if (snr !== 'all' && String(item.snr) !== snr) return false;
    if (processing !== 'all' && item.processing !== processing) return false;
    if (search) {
      const haystack = [
        item.displayName,
        item.method,
        item.methodFamily,
        item.parameter,
        item.fileName,
        item.processing,
        branchLabel(item),
        TOP_BRANCH_LABELS[topBranchKey(item)],
      ].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function branchLabel(item) {
  return BRANCH_LABELS[branchKey(item)];
}

function topBranchKey(item) {
  if (item.processing === 'source') return 'source';
  if (item.processing === 'specsub_mics') return 'specsub';
  return 'noisy';
}

function branchKey(item) {
  if (item.processing === 'source' || item.processing === 'noisy_mics' || item.processing === 'norm_noisy_mics' || item.processing === 'specsub_mics') return 'reference';
  if (item.processing === 'SpecSub') return 'specsub';
  if (item.processing === 'Noisy') return 'noisy';
  return 'noisy';
}

function conditionLabel(item) {
  const labels = {
    source: 'Reference',
    noisy_mics: 'Input',
    norm_noisy_mics: 'Input',
    specsub_mics: 'Input',
    Noisy: 'Noisy',
    SpecSub: 'SpecSub',
    unknown: 'Unknown',
  };
  return labels[item.processing] || item.processing;
}

function displayName(item) {
  if (item.method === 'Oracle_MINT') return 'MINT-Reference';
  if (item.methodFamily === 'WPE') return 'WPE';
  if (item.methodFamily === 'GWPE') return 'GWPE';
  if (item.method === 'BCI_Lp') return `MINT-ℓp (${item.parameter})`;
  if (item.method === 'BCI_ELp') return `MINT-Eℓp (${item.parameter})`;
  return item.displayName.replaceAll('BCI', 'MINT');
}

function badgeLabel(item) {
  if (branchKey(item) === 'reference') return conditionLabel(item);
  return branchLabel(item);
}

function renderAudioRow(item) {
  const row = document.createElement('article');
  row.className = 'audio-row';
  row.dataset.id = item.id;

  const meta = document.createElement('div');
  meta.className = 'audio-meta';
  meta.innerHTML = `
    <div>
      <h5>${displayName(item)}</h5>
    </div>
    <div class="badges">
      <span class="badge">${badgeLabel(item)}</span>
      <span class="badge muted">SNR ${item.snr}</span>
    </div>
  `;

  const player = document.createElement('audio');
  player.controls = true;
  player.preload = 'none';
  player.src = encodeURI(item.path);

  const tools = document.createElement('div');
  tools.className = 'viz-tools';
  const waveformButton = document.createElement('button');
  waveformButton.type = 'button';
  waveformButton.textContent = 'Waveform';
  const spectrogramButton = document.createElement('button');
  spectrogramButton.type = 'button';
  spectrogramButton.textContent = 'Spectrogram';
  tools.append(waveformButton, spectrogramButton);

  const vizPanel = document.createElement('div');
  vizPanel.className = 'viz-panel';

  const canvas = document.createElement('canvas');
  canvas.className = 'visualization';
  canvas.height = 150;
  vizPanel.append(canvas, tools);

  const status = document.createElement('p');
  status.className = 'row-status';

  async function render(mode) {
    waveformButton.classList.toggle('active', mode === 'waveform');
    spectrogramButton.classList.toggle('active', mode === 'spectrogram');
    status.textContent = mode === 'waveform' ? 'Rendering waveform...' : 'Computing spectrogram...';
    try {
      if (mode === 'waveform') await renderWaveform(canvas, item.path);
      if (mode === 'spectrogram') await renderSpectrogram(canvas, item.path);
      status.textContent = '';
    } catch (error) {
      status.textContent = error.message;
      status.classList.add('error');
    }
  }

  waveformButton.addEventListener('click', () => render('waveform'));
  spectrogramButton.addEventListener('click', () => render('spectrogram'));

  row.append(meta, player, vizPanel, status);
  requestAnimationFrame(() => render('waveform'));
  return row;
}

function makeSummary(label, count) {
  const summary = document.createElement('summary');
  summary.innerHTML = `<span>${label}</span><span>${count} examples</span>`;
  return summary;
}

function renderTopBranch(branch, items) {
  const branchBlock = document.createElement('div');
  branchBlock.className = 'top-branch-block';

  const list = document.createElement('div');
  list.className = 'audio-list';
  for (const item of items) list.append(renderAudioRow(item));
  branchBlock.append(list);
  return branchBlock;
}

function branchMethodPrefix(items) {
  if (items.every(item => item.methodFamily === 'WPE' || item.methodFamily === 'GWPE')) return 'WPE/GWPE';
  return 'BMCI-MINT';
}

function branchTitle(branch, items) {
  return `${branchMethodPrefix(items)} ${BRANCH_LABELS[branch].toLowerCase()}`;
}

function renderBranch(branch, items) {
  const branchBlock = document.createElement('details');
  branchBlock.className = `branch-block ${branch === 'reference' ? 'reference-branch' : ''}`;
  branchBlock.open = false;
  branchBlock.append(makeSummary(branchTitle(branch, items), items.length));

  const list = document.createElement('div');
  list.className = 'audio-list';
  for (const item of items) list.append(renderAudioRow(item));
  branchBlock.append(list);
  return branchBlock;
}

function renderMintContent(container, mintItems, options = {}) {
  const { includeReferences = true } = options;
  const topItems = includeReferences ? mintItems.filter(item => branchKey(item) === 'reference') : [];
  if (topItems.length) {
    const topGroups = groupBy(topItems, topBranchKey);
    const topColumns = document.createElement('div');
    topColumns.className = 'top-branch-columns';
    for (const topBranch of ['source', 'noisy', 'specsub']) {
      if (topGroups.has(topBranch)) topColumns.append(renderTopBranch(topBranch, topGroups.get(topBranch)));
    }
    container.append(topColumns);
  }

  const branchItems = mintItems.filter(item => branchKey(item) !== 'reference');
  const methodGroups = [
    branchItems.filter(item => item.methodFamily === 'WPE' || item.methodFamily === 'GWPE'),
    branchItems.filter(item => item.methodFamily !== 'WPE' && item.methodFamily !== 'GWPE'),
  ].filter(group => group.length);

  for (const methodItems of methodGroups) {
    const branchGroups = groupBy(methodItems, branchKey);
    const branchColumns = document.createElement('div');
    branchColumns.className = 'branch-columns';
    for (const branch of ['noisy', 'specsub']) {
      if (branchGroups.has(branch)) branchColumns.append(renderBranch(branch, branchGroups.get(branch)));
    }
    if (branchColumns.childElementCount) container.append(branchColumns);
  }
}

function renderNav(navItems) {
  if (!els.nav) {
    els.nav = document.createElement('nav');
    els.nav.className = 'page-nav';
    els.nav.setAttribute('aria-label', 'Page navigation');
    document.body.append(els.nav);
  }

  els.nav.innerHTML = '<button type="button" class="nav-toggle" aria-label="Collapse navigation">›</button><h2>Quickly locate</h2>';
  const toggle = els.nav.querySelector('.nav-toggle');
  toggle.addEventListener('click', () => {
    const collapsed = els.nav.classList.toggle('collapsed');
    toggle.textContent = collapsed ? '‹' : '›';
    toggle.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
  });
  const list = document.createElement('ul');
  for (const item of navItems) {
    const li = document.createElement('li');
    li.className = `nav-${item.level}`;
    const a = document.createElement('a');
    a.href = `#${item.id}`;
    a.textContent = item.label;
    li.append(a);
    list.append(li);
  }
  els.nav.append(list);
  els.nav.hidden = navItems.length === 0;
}

function mintRegLabel(mintreg) {
  return mintreg === '0.1' ? 'λ = 0.1 (default regularization)' : `λ = ${mintreg}`;
}

function renderGroup(category, items, navItems) {
  const section = document.createElement('details');
  section.className = 'experiment-section';
  section.open = true;
  const groupId = uniqueId('exp', [category]);
  section.id = groupId;
  navItems.push({ level: 'experiment', id: groupId, label: CATEGORY_LABELS[category] || category });
  section.append(makeSummary(CATEGORY_LABELS[category] || category, items.length));

  const snrGroups = groupBy(items, item => item.snr);
  for (const [snr, snrItems] of [...snrGroups.entries()].sort((a, b) => b[0] - a[0])) {
    const snrSection = document.createElement(category === 'comparison' ? 'details' : 'div');
    snrSection.className = 'condition-section';
    if (category === 'comparison') snrSection.open = false;
    const snrId = uniqueId('snr', [category, snr]);
    snrSection.id = snrId;
    if (category === 'comparison') {
      navItems.push({ level: 'snr', id: snrId, label: `SNR ${snr} dB` });
      snrSection.append(makeSummary(`SNR ${snr} dB`, snrItems.length));
      renderMintContent(snrSection, snrItems);
    } else {
      const referenceItems = snrItems.filter(item => branchKey(item) === 'reference' && item.mintreg === '0.1');
      if (referenceItems.length) {
        const referenceBlock = document.createElement('div');
        referenceBlock.className = 'mint-reference-block';
        renderMintContent(referenceBlock, referenceItems);
        snrSection.append(referenceBlock);
      }

      const baselineItems = snrItems.filter(item => branchKey(item) !== 'reference' && item.mintreg === null);
      if (baselineItems.length) {
        const baselineBlock = document.createElement('div');
        baselineBlock.className = 'mint-baseline-block';
        renderMintContent(baselineBlock, baselineItems);
        snrSection.append(baselineBlock);
      }

      const mintGroups = groupBy(snrItems.filter(item => branchKey(item) !== 'reference' && item.mintreg !== null), item => item.mintreg ?? '0.1');
      for (const [mintreg, mintItems] of [...mintGroups.entries()].sort((a, b) => Number(b[0]) - Number(a[0]))) {
        const mintId = uniqueId('mintreg', [category, snr, mintreg]);
        navItems.push({ level: 'snr', id: mintId, label: mintRegLabel(mintreg) });

        const block = document.createElement('details');
        block.className = 'mint-block';
        block.open = false;
        block.id = mintId;
        block.append(makeSummary(mintRegLabel(mintreg), mintItems.length));
        renderMintContent(block, mintItems);
        snrSection.append(block);
      }
    }
    section.append(snrSection);
  }
  return section;
}

function renderContent() {
  const baseItems = visibleItems();
  const filtered = filterItems(baseItems);
  els.status.textContent = `${filtered.length} of ${baseItems.length} examples shown`;
  els.content.innerHTML = '';

  if (!filtered.length) {
    els.content.innerHTML = '<p class="empty">No audio examples match the current filters.</p>';
    return;
  }

  const navItems = [];
  const groups = groupBy(filtered, experimentCategory);
  for (const category of ['comparison', 'snr5']) {
    if (!groups.has(category)) continue;
    els.content.append(renderGroup(category, groups.get(category), navItems));
  }
  renderNav(navItems);
}

async function init() {
  try {
    const response = await fetch('./audio-manifest.json');
    if (!response.ok) throw new Error('audio-manifest.json not found. Run node scripts/generate-manifest.mjs first.');
    state.manifest = await response.json();
    renderSummary();
    renderFilters();
    renderContent();
  } catch (error) {
    els.status.textContent = error.message;
    els.status.classList.add('error');
  }
}

init();

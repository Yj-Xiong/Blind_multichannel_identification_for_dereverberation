import { readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'audio-manifest.json');
const EXPECTED_TOTAL = 215;
const EXPECTED_GROUPS = {
  'sim1024_rho0.1': 129,
  'sim1024_rho0.5': 58,
  wpe_gwpe_noisy: 28,
};
const IGNORED_DIRS = new Set(['.git', '.claude', 'node_modules', 'webMUSHRA-master']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.wav')) {
      files.push(fullPath);
    }
  }
  return files;
}

function toRelativeUrl(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function stripSpecialPrefix(fileName) {
  return fileName.replace(/^[^_]+_snr\d+_mintreg[^_]+__/, '');
}

function parseMethod(rawName) {
  const base = rawName.replace(/\.wav$/i, '');

  if (base === 'raw_source') {
    return {
      processing: 'source',
      methodFamily: 'Reference',
      method: 'Source',
      parameter: '',
      displayName: 'Clean source',
    };
  }
  if (base === 'raw_noisy_mics') {
    return {
      processing: 'noisy_mics',
      methodFamily: 'Input',
      method: 'Noisy mics',
      parameter: '',
      displayName: 'Noisy microphones',
    };
  }
  if (base === 'norm_noisy_mics') {
    return {
      processing: 'norm_noisy_mics',
      methodFamily: 'Input',
      method: 'Normalized noisy mics',
      parameter: '',
      displayName: 'Normalized noisy microphones',
    };
  }
  if (base === 'raw_specsub_mics') {
    return {
      processing: 'specsub_mics',
      methodFamily: 'Input',
      method: 'SpecSub mics',
      parameter: '',
      displayName: 'Spectral-subtraction noisy',
    };
  }

  const match = base.match(/^raw_(Noisy|SpecSub)_(.+)$/);
  if (!match) {
    return {
      processing: 'unknown',
      methodFamily: 'Unknown',
      method: base,
      parameter: '',
      displayName: base.replaceAll('_', ' '),
    };
  }

  const processing = match[1];
  const tail = match[2];

  if (tail === 'Oracle_MINT') {
    return {
      processing,
      methodFamily: 'Oracle',
      method: 'Oracle_MINT',
      parameter: '',
      displayName: 'MINT-Reference',
    };
  }

  const bciParam = tail.match(/^BCI_(L?p|ELp)_p=(.+)$/);
  if (bciParam) {
    const method = bciParam[1] === 'Lp' ? 'BCI_Lp' : `BCI_${bciParam[1]}`;
    return {
      processing,
      methodFamily: 'BCI',
      method,
      parameter: `p=${bciParam[2]}`,
      p: Number(bciParam[2]),
      displayName: `${method.replace('BCI_', 'BCI-')}, p=${bciParam[2]}`,
    };
  }

  const bciSimple = tail.match(/^BCI_(NMCFLMS|RNMCFLMS)$/);
  if (bciSimple) {
    return {
      processing,
      methodFamily: 'BCI',
      method: `BCI_${bciSimple[1]}`,
      parameter: '',
      displayName: `BCI-${bciSimple[1]}`,
    };
  }

  if (tail === 'WPE_paper') {
    return {
      processing,
      methodFamily: 'WPE',
      method: 'WPE_paper',
      parameter: '',
      displayName: 'WPE (paper)',
    };
  }

  const gwpe = tail.match(/^GWPE_K(\d+)_d(\d+)_i(\d+)$/);
  if (gwpe) {
    return {
      processing,
      methodFamily: 'GWPE',
      method: 'GWPE',
      parameter: `K=${gwpe[1]}, d=${gwpe[2]}, i=${gwpe[3]}`,
      K: Number(gwpe[1]),
      d: Number(gwpe[2]),
      i: Number(gwpe[3]),
      displayName: `GWPE K=${gwpe[1]}, d=${gwpe[2]}, i=${gwpe[3]}`,
    };
  }

  return {
    processing,
    methodFamily: tail.split('_')[0] || 'Other',
    method: tail,
    parameter: '',
    displayName: tail.replaceAll('_', ' '),
  };
}

function methodRank(item) {
  const referenceRanks = {
    source: 0,
    noisy_mics: 1,
    norm_noisy_mics: 2,
    specsub_mics: 3,
  };
  if (item.processing in referenceRanks) return referenceRanks[item.processing];

  const processingOffset = item.processing === 'Noisy' ? 10 : item.processing === 'SpecSub' ? 30 : 50;
  const methodRanks = {
    Oracle_MINT: 0,
    BCI_NMCFLMS: 1,
    BCI_RNMCFLMS: 2,
    BCI_Lp: 3,
    BCI_ELp: 4,
    WPE_paper: 1,
    GWPE: 2,
  };
  const base = methodRanks[item.method] ?? 20;
  const pOffset = Number.isFinite(item.p) ? item.p / 10 : 0;
  return processingOffset + base + pOffset;
}

function parseItem(filePath) {
  const relativePath = toRelativeUrl(filePath);
  const parts = relativePath.split('/');
  const group = parts[0];
  const snrPart = parts.find(part => /^snr\d+$/i.test(part));
  const snr = snrPart ? Number(snrPart.replace(/snr/i, '')) : null;
  const rawFileName = parts.at(-1);
  const fileName = stripSpecialPrefix(rawFileName);
  const snrIndex = parts.findIndex(part => /^snr\d+$/i.test(part));
  const maybeMintreg = parts[snrIndex + 1];
  const mintreg = maybeMintreg && /^\d+(\.\d+)?$/.test(maybeMintreg) ? maybeMintreg : null;

  const rhoMatch = group.match(/^sim1024_rho(.+)$/);
  const experiment = rhoMatch ? 'sim1024' : group;
  const rho = rhoMatch ? rhoMatch[1] : null;
  const parsed = parseMethod(fileName);

  const id = relativePath
    .replace(/\.wav$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return {
    id,
    path: relativePath,
    fileName: rawFileName,
    normalizedFileName: fileName,
    group,
    experiment,
    rho,
    snr,
    mintreg,
    ...parsed,
    sort: {
      group: ['sim1024_rho0.1', 'sim1024_rho0.5', 'wpe_gwpe_noisy'].indexOf(group),
      snr,
      mintreg: mintreg === null ? -1 : Number(mintreg),
      method: 0,
    },
  };
}

function sortItems(a, b) {
  return (a.sort.group - b.sort.group)
    || (a.snr - b.snr)
    || ((Number(a.mintreg ?? -1)) - (Number(b.mintreg ?? -1)))
    || (methodRank(a) - methodRank(b))
    || a.displayName.localeCompare(b.displayName)
    || a.path.localeCompare(b.path);
}

const wavFiles = await walk(ROOT);
const items = wavFiles.map(parseItem).sort(sortItems);
const counts = items.reduce((acc, item) => {
  acc[item.group] = (acc[item.group] || 0) + 1;
  return acc;
}, {});

const manifest = {
  generatedAt: new Date().toISOString(),
  total: items.length,
  counts,
  groups: Object.keys(EXPECTED_GROUPS),
  items,
};

await writeFile(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Wrote ${path.relative(ROOT, OUTPUT)} with ${items.length} audio files.`);
for (const group of Object.keys(EXPECTED_GROUPS)) {
  console.log(`${group}: ${counts[group] || 0}`);
}
if (items.length !== EXPECTED_TOTAL) {
  console.warn(`Warning: expected ${EXPECTED_TOTAL} wav files, found ${items.length}.`);
}
for (const [group, expected] of Object.entries(EXPECTED_GROUPS)) {
  if ((counts[group] || 0) !== expected) {
    console.warn(`Warning: expected ${expected} files in ${group}, found ${counts[group] || 0}.`);
  }
}

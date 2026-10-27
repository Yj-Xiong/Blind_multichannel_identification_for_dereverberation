import assert from 'node:assert/strict';
import { migrateAirAudio } from './audio_revision.mjs';

const trials = [
  ...Array.from({ length: 56 }, (_, index) => ({
    dataset: 'ACE', sample_id: `ace_${index + 1}`,
  })),
  ...Array.from({ length: 107 }, (_, index) => ({
    dataset: 'AIR', sample_id: `air_${index + 1}`,
  })),
];
const aceScores = Object.fromEntries(trials.slice(0, 56).map((trial, index) => [
  trial.sample_id, { hidden_reference: 10, unprocessed: index / 10 },
]));
const state = {
  index: 58,
  sessionId: 'existing-session',
  airAudioVersion: 'original-v1',
  submittedAt: 'old-submission',
  scores: { ...aceScores, air_1: { hidden_reference: 9 }, air_2: { hidden_reference: 8 } },
};
const result = migrateAirAudio(state, trials, 'air-rms27-peak1p5-v1');
assert.deepEqual(result, { changed: true, removed: 2 });
assert.equal(state.index, 56);
assert.equal(state.sessionId, 'existing-session');
assert.deepEqual(Object.fromEntries(Object.entries(state.scores).filter(([key]) => key.startsWith('ace_'))), aceScores);
assert.equal(state.scores.air_1, undefined);
assert.equal(state.scores.air_2, undefined);
assert.equal(state.submittedAt, undefined);
assert.deepEqual(migrateAirAudio(state, trials, 'air-rms27-peak1p5-v1'),
  { changed: false, removed: 0 });
console.log('ACE ratings preserved; older AIR ratings cleared once');

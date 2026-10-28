import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { orderedTrials, STUDIES } from './study_modes.mjs';

const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url)));
const joint = orderedTrials(manifest, 'joint');
const ace = orderedTrials(manifest, 'ace');
const air = orderedTrials(manifest, 'air');

assert.equal(joint.length, 163);
assert.equal(ace.length, 56);
assert.equal(air.length, 107);
assert.deepEqual(joint, [...ace, ...air]);
assert.equal(new Set(ace.map((trial) => trial.sample_id)).size, 56);
assert.equal(new Set(air.map((trial) => trial.scene_id)).size, 107);
assert.ok(ace.every((trial) => trial.dataset === 'ACE'));
assert.ok(air.every((trial) => trial.dataset === 'AIR' && trial.snr_db === 30));
assert.equal(new Set(Object.values(STUDIES).map((study) => study.storageKey)).size, 3);
assert.equal(new Set(Object.values(STUDIES).map((study) => study.study)).size, 3);
assert.equal(STUDIES.joint.storageKey, manifest.study);
console.log('Joint 163, ACE 56, AIR 107; study and storage keys are distinct');

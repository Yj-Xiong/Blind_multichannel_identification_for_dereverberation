export function migrateAirAudio(state, trials, newVersion) {
  const oldVersion = state.airAudioVersion || 'original-v1';
  if (oldVersion === newVersion) return { changed: false, removed: 0 };
  let removed = 0;
  const firstAir = trials.findIndex((trial) => trial.dataset === 'AIR');
  if (firstAir < 0) throw new Error('AIR 样本缺失');
  state.scores ||= {};
  for (const trial of trials) {
    if (trial.dataset !== 'AIR') continue;
    if (Object.prototype.hasOwnProperty.call(state.scores, trial.sample_id)) {
      delete state.scores[trial.sample_id];
      removed += 1;
    }
  }
  state.index = Math.min(state.index, firstAir);
  delete state.submittedAt;
  delete state.submittedPayload;
  state.airAudioVersion = newVersion;
  return { changed: true, removed };
}

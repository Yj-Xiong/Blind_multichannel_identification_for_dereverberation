export const STUDIES = {
  joint: {
    study: 'ace56-air30-joint-v3',
    storageKey: 'ace56-air30-joint-v3',
    downloadPrefix: 'ace-air-listening',
    datasets: ['ACE', 'AIR'],
  },
  ace: {
    study: 'ace56-only-v1',
    storageKey: 'ace56-only-v1',
    downloadPrefix: 'ace-listening',
    datasets: ['ACE'],
  },
  air: {
    study: 'air30-only-v1',
    storageKey: 'air30-only-v1',
    downloadPrefix: 'air-listening',
    datasets: ['AIR'],
  },
};

export function orderedTrials(manifest, mode = 'joint') {
  if (!STUDIES[mode]) throw new Error('未知听评入口');
  const ace = manifest.trials.filter((trial) => trial.dataset === 'ACE');
  const air = manifest.trials.filter((trial) => trial.dataset === 'AIR');
  const scenes = [...new Set(ace.map((trial) => trial.scene_id))].sort();
  const bySceneAndSnr = new Map(ace.map((trial) => [`${trial.scene_id}:${trial.snr_db}`, trial]));
  if (scenes.length !== 14 || ace.length !== 56 || air.length !== 107
    || air.some((trial) => trial.snr_db !== 30)
    || new Set(air.map((trial) => trial.scene_id)).size !== 107) {
    throw new Error('ACE / AIR 样本清单不完整');
  }
  const aceOrder = Array.from({ length: 7 }, (_, group) => [10, 20, 30, 40].flatMap((snr, snrIndex) => {
    const pair = ((group + snrIndex) % 7) * 2;
    return [scenes[pair], scenes[pair + 1]].map((scene) => bySceneAndSnr.get(`${scene}:${snr}`));
  })).flat();
  if (aceOrder.some((trial) => !trial)) throw new Error('ACE 样本清单缺少 SNR 条件');
  if (mode === 'ace') return aceOrder;
  if (mode === 'air') return air;
  return [...aceOrder, ...air];
}

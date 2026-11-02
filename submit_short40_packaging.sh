#!/usr/bin/env bash
set -euo pipefail

ROOT=/hpc_stor01/home/yujie.xiong_sx/AutoResearch
PY=/hpc_stor01/home/yujie.xiong_sx/.conda/envs/rec-rir-mc/bin/python
MODE=${1:?mode must be prepare or final}
if [[ "$MODE" != prepare && "$MODE" != final ]]; then
  echo "mode must be prepare or final" >&2
  exit 2
fi
JOB_NAME="p808-short40-${MODE}"
LOG=${ROOT}/subjective_se_pages/p808/${JOB_NAME}.JOB.log
OUTPUT=${ROOT}/subjective_se_pages/p808/short40_manifest.json
ARGS=""
if [[ "$MODE" == prepare ]]; then ARGS="--prepare-available"; fi
JOB_ID=$(vc submit --nopassenv \
  --image docker.v2.aispeech.com/hpc/ai_on_device_base-nsp:1.1.1 \
  --partition pdcpu --mem-per-task 32G --cpu-per-task 8 \
  --project p808_short40_packaging --job "$JOB_NAME" \
  JOB=1:1 "$LOG" \
  --cmd "cd '$ROOT' && '$PY' '$ROOT/subjective_se_pages/build_short40_manifest.py' $ARGS")
printf 'device=cpu job_id=%s partition=pdcpu project=p808_short40_packaging job=%s log=%s output=%s status=submitted\n' "$JOB_ID" "$JOB_NAME" "$LOG" "$OUTPUT"

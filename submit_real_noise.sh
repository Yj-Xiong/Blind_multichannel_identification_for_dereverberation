#!/usr/bin/env bash
set -euo pipefail

ROOT=/hpc_stor01/home/yujie.xiong_sx/AutoResearch
PY=/hpc_stor01/home/yujie.xiong_sx/.conda/envs/rec-rir-mc/bin/python
JOB_NAME=p808-real-recorded-noise-5to20db
LOG=${ROOT}/subjective_se_pages/p808/real_noisy_5to20db_v1/${JOB_NAME}.JOB.log
OUTPUT=${ROOT}/subjective_se_pages/p808/real_noisy_5to20db_v1/manifest.json
mkdir -p "$(dirname "$LOG")"
JOB_ID=$(vc submit --nopassenv \
  --image docker.v2.aispeech.com/hpc/ai_on_device_base-nsp:1.1.1 \
  --partition pdcpu --mem-per-task 32G --cpu-per-task 8 \
  --project p808_real_noise --job "$JOB_NAME" \
  JOB=1:1 "$LOG" \
  --cmd "cd '$ROOT' && '$PY' '$ROOT/subjective_se_pages/add_real_recording_noise.py'")
printf 'device=cpu job_id=%s partition=pdcpu project=p808_real_noise job=%s log=%s output=%s status=submitted\n' "$JOB_ID" "$JOB_NAME" "$LOG" "$OUTPUT"

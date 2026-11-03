#!/usr/bin/env bash
set -euo pipefail

ROOT=/hpc_stor01/home/yujie.xiong_sx/AutoResearch/subjective_short40_fresh
PY=/hpc_stor01/home/yujie.xiong_sx/.conda/envs/rec-rir-mc/bin/python
LOG=${ROOT}/real8s_page.JOB.log
OUTPUT=${ROOT}/p808/real-recording.html
JOB=subjective-real8s-page
ID=$(vc submit --nopassenv \
  --image docker.v2.aispeech.com/hpc/ai_on_device_base-nsp:1.1.1 \
  --partition pdcpu --mem-per-task 32G --cpu-per-task 8 \
  --project subjective_real8s --job "${JOB}" \
  JOB=1:1 "${LOG}" \
  --cmd "cd '${ROOT}' && OMP_NUM_THREADS=4 OPENBLAS_NUM_THREADS=1 '${PY}' '${ROOT}/build_real8s_listening_page.py'")
printf 'device=cpu job_id=%s partition=pdcpu project=subjective_real8s job=%s log=%s output=%s status=Submitted\n' \
  "$ID" "$JOB" "$LOG" "$OUTPUT" | tee -a "${ROOT}/real8s_jobs.log"

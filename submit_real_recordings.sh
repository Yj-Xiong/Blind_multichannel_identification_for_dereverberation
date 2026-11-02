#!/usr/bin/env bash
set -euo pipefail

ROOT=/hpc_stor01/home/yujie.xiong_sx/AutoResearch
PY=/hpc_stor01/home/yujie.xiong_sx/.conda/envs/rec-rir-mc/bin/python
MODEL=${1:?model required}
DEVICE=${2:-4090}
if [[ "$DEVICE" != 4090 && "$DEVICE" != 3090 && "$DEVICE" != v100 ]]; then
  echo "unsupported device: $DEVICE" >&2
  exit 2
fi
EXTRA=()
if [[ "$DEVICE" == 3090 ]]; then EXTRA=(--enable-rdma 1); fi
LOG_DIR=${ROOT}/subjective_se_pages/p808/real_inference/logs
mkdir -p "$LOG_DIR"
JOB_NAME="p808-real-${MODEL}-${DEVICE}"
LOG="${LOG_DIR}/${JOB_NAME}.JOB.log"
OUTPUT="${ROOT}/subjective_se_pages/p808/real_inference/${MODEL}"
vc submit --nopassenv "${EXTRA[@]}" \
  --image docker.v2.aispeech.com/hpc/ai_on_device_base-nsp:1.1.1 \
  --partition "pdgpu-${DEVICE}" --gpu-per-task 1 \
  --mem-per-task 32G --cpu-per-task 8 \
  --project p808_real_inference --job "$JOB_NAME" \
  JOB=1:1 "$LOG" \
  --cmd "cd '$ROOT' && PYTHONPATH='$ROOT/CleanMel:$ROOT' PYTHONNOUSERSITE=1 '$PY' '$ROOT/subjective_se_pages/infer_real_recordings.py' --model '$MODEL'"
printf 'device=%s partition=pdgpu-%s project=p808_real_inference job=%s log=%s output=%s\n' "$DEVICE" "$DEVICE" "$JOB_NAME" "$LOG" "$OUTPUT"

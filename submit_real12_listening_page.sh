#!/usr/bin/env bash
set -euo pipefail

ROOT=/hpc_stor01/home/yujie.xiong_sx/AutoResearch/subjective_short40_fresh
LOG="$ROOT/real12_listening_build.JOB.log"

vc submit --nopassenv \
  --image docker.v2.aispeech.com/hpc/ai_on_device_base-nsp:1.1.1 \
  --partition pdcpu --mem-per-task 8G --cpu-per-task 2 \
  --project subjective_real12 --job subjective-real12-reference-and-page \
  JOB=1:1 "$LOG" \
  --cmd "python $ROOT/build_real12_listening_page.py"

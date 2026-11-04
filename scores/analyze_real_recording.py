#!/usr/bin/env python3
"""Build the public 12-recording subjective/objective analysis.

The script is safe to run before any real-recording submissions arrive. It
publishes the objective table, then writes a pending status until matching
subjective rows exist in scores/latest.csv.
"""

from __future__ import annotations

import csv
import json
import math
import re
import shutil
from collections import defaultdict
from pathlib import Path



ROOT = Path(__file__).resolve().parent.parent
SCORES = ROOT / "scores"
P808 = ROOT / "p808"
OUT = P808 / "real12_analysis"
LOCAL_OBJECTIVE = ROOT / "p808" / "real12_analysis" / "objective_source.csv"
PUBLIC_OBJECTIVE = OUT / "objective_per_sample.csv"
TASK_IDS = {"dereverbReal12v3", "dereverb-p808-real12-v3", "dereverbReal12v2", "dereverb-p808-real12-v2"}
SAMPLES = [f"real_4floor_{i:02d}" for i in range(1, 13)]
MODELS = {"cleanmel-offline-l-map", "vinp-ospatialnet", "vinp-tcnsas",
          "dytswig-mamba-ccfaatc", "unipase", "buddy-official",
          "mc-buddy", "usddps"}
CONTROL = {"unprocessed", "hidden_reference"}
LOWER_IS_BETTER = {"lsd"}
META = {"dataset", "dataset_version", "sample_id", "track",
        "target_added_noise_snr_db", "enhanced_audio", "enhanced_sha256",
        "reference_audio", "reference_sha256"}


def copy_objective() -> list[dict]:
    source = LOCAL_OBJECTIVE if LOCAL_OBJECTIVE.is_file() else PUBLIC_OBJECTIVE
    if not source.is_file():
        return []
    rows = list(csv.DictReader(source.open(encoding="utf-8-sig", newline="")))
    OUT.mkdir(parents=True, exist_ok=True)
    if source != PUBLIC_OBJECTIVE:
        clean_rows = []
        for row in rows:
            row = dict(row)
            for field in ("enhanced_audio", "reference_audio"):
                path = Path(row.get(field, ""))
                if path.name:
                    if field == "enhanced_audio":
                        row[field] = f"p808/real8s_lufs_lossless_v1/{row['track']}/{row['sample_id']}.wav"
                    else:
                        row[field] = f"p808/real8s_lufs_lossless_v1/reference/{row['sample_id']}.wav"
            clean_rows.append(row)
        rows = clean_rows
        with PUBLIC_OBJECTIVE.open("w", encoding="utf-8-sig", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)
    return rows


def read_subjective() -> list[dict]:
    path = SCORES / "latest.csv"
    if not path.is_file():
        return []
    rows = []
    with path.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            if row.get("task_id") not in TASK_IDS or row.get("sample_id") not in SAMPLES:
                continue
            try:
                score = float(row["score"])
                if not math.isfinite(score):
                    continue
            except (TypeError, ValueError):
                continue
            row["score"] = score
            rows.append(row)
    return rows


def corr(xs, ys):
    if len(xs) < 3:
        return None, None
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    dx = [value - mx for value in xs]
    dy = [value - my for value in ys]
    denom = (sum(value * value for value in dx) *
             sum(value * value for value in dy)) ** 0.5
    if denom == 0:
        return None, None
    pearson = sum(a * b for a, b in zip(dx, dy)) / denom

    def ranks(values):
        order = sorted(range(len(values)), key=values.__getitem__)
        output = [0.0] * len(values)
        index = 0
        while index < len(order):
            end = index + 1
            while end < len(order) and values[order[end]] == values[order[index]]:
                end += 1
            rank = (index + end - 1) / 2.0 + 1.0
            for position in order[index:end]:
                output[position] = rank
            index = end
        return output

    rx, ry = ranks(xs), ranks(ys)
    rmx, rmy = sum(rx) / len(rx), sum(ry) / len(ry)
    rdx = [value - rmx for value in rx]
    rdy = [value - rmy for value in ry]
    rdenom = (sum(value * value for value in rdx) *
              sum(value * value for value in rdy)) ** 0.5
    spearman = None if rdenom == 0 else sum(a * b for a, b in zip(rdx, rdy)) / rdenom
    return float(pearson), (None if spearman is None else float(spearman))


def write_csv(path, fields, rows):
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    objective = copy_objective()
    subjective = read_subjective()

    coverage = defaultdict(set)
    for row in subjective:
        coverage[row["sample_id"]].add(row.get("user_id", ""))
    coverage_rows = [{"sample_id": sample, "listener_count": len(coverage[sample]),
                     "score_rows": sum(r["sample_id"] == sample for r in subjective)}
                    for sample in SAMPLES]
    write_csv(OUT / "coverage.csv", ("sample_id", "listener_count", "score_rows"), coverage_rows)

    objective_by_key = {(row["sample_id"], row["track"]): row for row in objective}
    subjective_by_key = defaultdict(list)
    for row in subjective:
        subjective_by_key[row["sample_id"], row["candidate_key"]].append(row["score"])
    mean_rows = []
    for key, values in sorted(subjective_by_key.items()):
        mean_rows.append({"sample_id": key[0], "candidate_key": key[1],
                          "listener_count": len(values), "subjective_mean": float(np.mean(values))})
    write_csv(OUT / "subjective_condition_means.csv",
              ("sample_id", "candidate_key", "listener_count", "subjective_mean"), mean_rows)

    metrics = [key for key in (objective[0] if objective else {}) if key not in META]
    correlations = []
    for metric in metrics:
        for scope, candidates in (("8_models", MODELS), ("10_tracks", MODELS | CONTROL)):
            points = []
            for row in mean_rows:
                if row["candidate_key"] not in candidates:
                    continue
                objective_candidate = ("reference" if row["candidate_key"] == "hidden_reference"
                                       else row["candidate_key"])
                obj = objective_by_key.get((row["sample_id"], objective_candidate))
                if not obj or obj.get(metric, "") == "":
                    continue
                try:
                    value = float(obj[metric])
                except ValueError:
                    continue
                if metric in LOWER_IS_BETTER:
                    value = -value
                points.append((value, float(row["subjective_mean"])))
            pearson, spearman = corr([p[0] for p in points], [p[1] for p in points])
            correlations.append({"scope": scope, "metric": metric,
                                 "condition_points": len(points),
                                 "pearson_r": "" if pearson is None else pearson,
                                 "spearman_r": "" if spearman is None else spearman,
                                 "direction": "negative_before_correlation" if metric in LOWER_IS_BETTER else "higher_is_better"})
    write_csv(OUT / "correlations.csv",
              ("scope", "metric", "condition_points", "pearson_r", "spearman_r", "direction"), correlations)

    status = {"schema": "se.subjective.real12_analysis.v1", "study": "dereverbReal12v3",
              "samples": len(SAMPLES), "objective_rows": len(objective),
              "subjective_rows": len(subjective), "listeners": len({r.get('user_id') for r in subjective}),
              "status": "ready" if subjective and objective else "waiting_for_subjective_scores"}
    (OUT / "status.json").write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    build_html(status, correlations, coverage_rows)
    print(json.dumps(status, ensure_ascii=False), flush=True)


def build_html(status, correlations, coverage):
    rows = [row for row in correlations if row["scope"] == "8_models" and row["pearson_r"] != ""]
    rows.sort(key=lambda row: float(row["pearson_r"]), reverse=True)
    ranking = "".join("<tr><td>{}</td><td>{}</td><td>{:.3f}</td><td>{:.3f}</td><td>{}</td></tr>".format(
        index, row["metric"], float(row["pearson_r"]), float(row["spearman_r"]), row["condition_points"])
        for index, row in enumerate(rows, 1)) or '<tr><td colspan="5">等待实录听评提交</td></tr>'
    coverage_html = "".join("<tr><td>{}</td><td>{}</td><td>{}</td></tr>".format(
        row["sample_id"], row["listener_count"], row["score_rows"]) for row in coverage)
    html = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>12条实录主客观分析</title>
<style>body{{font-family:Arial,sans-serif;max-width:1100px;margin:32px auto;padding:0 18px;color:#12304f}}h1{{color:#062a5f}}.status{{background:#eef4fb;padding:14px;border-left:4px solid #1268ad}}table{{border-collapse:collapse;width:100%;margin:18px 0}}th,td{{border-bottom:1px solid #d7e2ee;padding:8px;text-align:left}}th{{background:#f1f6fb}}</style>
<h1>12 条真实房间录音的去混响分析</h1><div class="status">状态：{status['status']}　样本：{status['samples']}　客观条件：{status['objective_rows']}　主观评分：{status['subjective_rows']}　听评者：{status['listeners']}</div>
<p>客观结果使用 8 秒、BS.1770 响度归一化版本。相关性按样本 × 候选条件点计算；LSD 在相关性前取负号。参考和未处理输入保留在 10 路范围，主排序使用 8 个增强模型。</p>
<h2>8 模型主客观相关性</h2><table><thead><tr><th>排名</th><th>指标</th><th>Pearson</th><th>Spearman</th><th>条件点</th></tr></thead><tbody>{ranking}</tbody></table>
<h2>样本覆盖</h2><table><thead><tr><th>样本</th><th>听评者数</th><th>评分行数</th></tr></thead><tbody>{coverage_html}</tbody></table>
<p>本页由 GitHub Actions 定时同步 Formspree 后自动重建；没有对应任务评分时只保留客观结果和等待状态。</p></html>'''
    (OUT / "index.html").write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()

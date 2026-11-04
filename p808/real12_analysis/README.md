# 12 条实录主客观分析

这个目录由 `scores/analyze_real_recording.py` 自动更新。

- `objective_per_sample.csv`：12 条实录、10 个候选声音的 8 秒客观结果。
- `objective_model_means.csv`：按候选声音汇总的客观均值。
- `coverage.csv`：每条实录当前被多少听评者评分。
- `subjective_condition_means.csv`：按样本和候选汇总的主观均分。
- `correlations.csv`：8 模型和完整 10 路范围的 Pearson、Spearman。
- `index.html`：可直接打开的简洁分析页面。
- `status.json`：当前同步状态。

评分同步由 GitHub Actions 每 15 分钟执行一次。没有 `dereverbReal12v3` 或兼容旧版本的实录评分时，目录保留客观结果，并显示等待状态；收到评分后按服务端接收时间去重，再自动更新覆盖、均分和相关性。

客观结果使用 8 秒、BS.1770 响度归一化版本。LSD 在相关性计算前取负号。主排序只使用 8 个增强模型，隐藏参考和未处理输入只用于完整 10 路对照。

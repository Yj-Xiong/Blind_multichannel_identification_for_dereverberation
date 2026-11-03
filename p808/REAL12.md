# 实录去混响听评

当前入口是 `p808/real-recording.html`，任务 ID 为 `dereverbReal12v2`。12 条真实房间录音各裁为 8 秒，两批各 6 条。两批的成员固定且互不重叠：一批为 01、03、05、07、09、11，另一批为 02、04、06、08、10、12。每个测试 ID 的第 1 批从两个批次中等概率抽取，第 2 批自动使用剩余批次；批次内顺序随机，同一 ID 返回时沿用已保存顺序。每条有公开参考播放器，以及参与评分的隐藏参考、未处理输入和 8 个模型输出。公开参考和隐藏参考来自同一段 WAV，最终 MP3 逐字节相同。所有声音在同一样本内使用完全相同的裁剪起止点。

裁剪窗口由干净播放参考的能量和边界停顿确定，不参考任何模型输出或客观得分。8 秒无损 WAV 与页面 MP3 使用同一裁剪和每路独立的 −27 dBFS RMS 目标、−1.5 dBFS 峰值上限。12 条原录音、对齐参考及模型输出仍保留 10 秒原版。ACE/AIR 的 28 条当前本来就是每条 3 秒，未修改。

页面及暂存提交使用独立的 v2 任务 ID、音频版本和浏览器进度键。历史 10 秒评分保持在 v1，不与新评分合并。旧入口 `real-listening.html` 跳转到当前入口；旧页面另存为 `real-listening-10s-archive.html`。同一测试 ID 在新版本可从第 1 批开始，之后继续未完成批次。

`real12_8s_manifest.json` 列出当前页面的 12 条样本、全部 132 个 MP3 路径与哈希；`real8s_crop_windows.json` 记录逐条窗口与无损 WAV 的哈希；`real8s_validation.json` 记录音频及客观分数配对校验。12 条实录的 8 秒客观结果位于 `../../subjective_se_pages/p808/real_objective_8s_v1/`，包含 20 项指标的逐样本 CSV 和均值 CSV。

构建与校验脚本分别为 `build_real8s_assets.py`、`build_real8s_listening_page.py` 和 `verify_real8s.py`。集群作业编号、分区、日志和输出路径见 `real8s_jobs.log`。原始 10 秒任务的清单仍保留为 `real12_manifest.json`。

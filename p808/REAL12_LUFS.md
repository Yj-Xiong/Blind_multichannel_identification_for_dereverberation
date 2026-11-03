# BS.1770 节目响度版本

当前入口为 `real-recording-lufs.html`，任务 ID 为 `dereverbReal12v3`。它使用与 8 秒 RMS 版本相同的裁剪窗口和固定两批样本，但所有公开参考、隐藏参考、未处理输入和模型输出都重新经过 ITU-R BS.1770 的 K-weighted gated loudness 处理。

音频版本为 `real8s-lufs23-tp1-v1`：目标 Integrated Loudness 为 −23 LUFS，最大 True Peak 为 −1 dBTP。FFmpeg `loudnorm` 两遍测量后，再做最终 BS.1770 扫描；若短语音的目标响度和 True Peak 上限不能同时满足，则保留不超过 −1 dBTP 的结果，并在 `real8s_lufs_crop_manifest.json` 记录最终测量值和限制原因。

这不是把 RMS 结果改名为 LUFS。RMS 版本 `real8s-rms27-peak1p5-v1` 和 BS.1770 版本拥有不同的音频版本、任务 ID、浏览器进度键和客观结果目录，不能混合分析。目标 −23 LUFS 是节目响度策略；BS.1770 定义测量算法，包含 K-weighting 和门控 Integrated Loudness。

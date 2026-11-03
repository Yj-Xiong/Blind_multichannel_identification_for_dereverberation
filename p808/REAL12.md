# 实录去混响听评

入口为 `p808/real-listening.html`，任务 ID 为 `dereverbReal12v1`。使用 12 段四通道房间录音的第 1 通道及其 8 个模型增强输出；每条提供未处理输入、公开参考和与公开参考字节相同的隐藏参考，共 10 路参与评分。公开参考只供聆听，隐藏参考参与 0–100 分评分。两批各 6 条；同一测试 ID 可恢复进度，两批不重复，浏览器存储键与 ACE/AIR 听评独立。

参考语音来自 `4floor_2m_deg180_12speech/playback_1sweep_1wgn_12speech(1).wav` 的 12 个干净播放片段。既有对齐记录将 12 段录音一一对应到同编号片段；16 kHz 下各片段均为 160000 个采样点，最大相对时差 2.0 ms。相同录音的匹配相关强度为次佳片段的 7.3～17.0 倍。参考的听评 MP3 采用与模型音频相同的 16 kHz 单声道、目标 −27 dBFS RMS、峰值上限 −1.5 dBFS 编码规则；解码后参考与其对齐 WAV 的相关系数为 0.9968～0.9997。12 段公开参考与隐藏参考逐文件 SHA-256 相同。

本页模型音频沿用 `real-noisy-5to20db-rms27-v1`，公开及隐藏参考放在 `real-aligned-playback-ref-rms27-v1`。正式侵入式客观指标应使用对齐的无损参考 WAV，并先检查各增强 WAV 的时延、截断和采样率；网页 MP3 只用于听评。录音与参考是同一句话的不同声学路径，干净播放源可作为干声目标，不代表房间内的真实声场波形。

页面复用现有 Formspree 暂存与整批提交机制，但使用独立任务 ID。完整清单及音频哈希见 `real12_manifest.json`。构建脚本为 `build_real12_listening_page.py`；本次 CPU 构建作业：`job-179370365996694218759-yujie-xiong-sx`，`pdcpu`，2 CPU、8G，项目 `subjective_real12`，作业名 `subjective-real12-reference-and-page`，日志 `real12_listening_build.1.log`，输出为 `p808/real12_manifest.json`、`p808/real-listening.html` 和 `p808/audio/real-aligned-playback-ref-rms27-v1/`，状态 `Completed`。

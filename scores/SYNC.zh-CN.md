# Formspree 暂存评分同步到 GitHub

听评页面已经把当前进度发到暂存表单 `mjyypvzy`。仓库的
[`sync-staged-scores.yml`](../.github/workflows/sync-staged-scores.yml)
每 15 分钟尝试读取该表单，并将有效提交写入公开的 `scores/inbox/`，
再生成按候选评分去重的 `scores/latest.csv`。GitHub 定时任务可能延迟运行。

## 启用

1. 在 Formspree 后台轮换此前在聊天中明文出现的密钥。只保留新暂存表单
   `mjyypvzy` 的**只读** API 密钥供同步使用；不需要主密钥。
2. 打开 GitHub 仓库的 **Settings → Secrets and variables → Actions**，
   新建仓库 Secret：`FORMS1MJY`（也兼容
   `FORMSPREE_STAGING_READ_ONLY_KEY`），值为刚生成的只读密钥。
   不要把密钥写进文件、工作流或网页。
3. 在 **Actions → Sync staged listening scores → Run workflow** 手动运行一次。
   成功后检查 `scores/inbox/` 和 `scores/latest.csv` 是否出现数据。
4. 若提交仓库时报权限错误，检查 **Settings → Actions → General →
   Workflow permissions** 是否允许该工作流写入仓库。

同步使用官方 Form Submissions API：
`GET https://formspree.io/api/0/forms/mjyypvzy/submissions`，通过 HTTP Basic
认证（用户名为空，密码为只读 API 密钥）。脚本按 `limit=100`、`offset` 和
`order=asc` 遍历提交，读取服务端 `_date`，逐条校验 `scores_csv`。重复提交
按 Formspree 提交 ID 或内容哈希归档，`latest.csv` 按
`task_id + user_id + sample_id + candidate_key` 选最新评分。

手动验证导出的 JSON 或 CSV 文件无需 API 密钥：

```bash
python -m scores.sync_formspree --input /path/to/formspree-export.json --output scores
```

Formspree 提交成功不等于 GitHub 已同步。Secret 未设置时工作流会明确失败，
不会把密钥写入日志。公开结果包含受试者填写的 ID，招募时应告知受试者。

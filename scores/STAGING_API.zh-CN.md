# 主观评分暂存接口

[English](STAGING_API.md)

听评页面将当前进度发送到独立的 Formspree 表单
`https://formspree.io/f/mjyypvzy`。该表单是暂存收件箱，**不是** GitHub
评分仓库。应在 Formspree 后台关闭此表单的邮件通知；完成整批后，页面会另外向原结果表单发送通知。
该表单返回过 `File Uploads Not Permitted`，因此当前改用普通文本字段发送 CSV，
不再上传文件附件。

## 请求方式

使用 `POST` 和 `multipart/form-data`；四个字段均为文本。浏览器会自动生成
请求边界，不要手动设置 `Content-Type`：

```bash
curl -X POST 'https://formspree.io/f/mjyypvzy' \
  -H 'Accept: application/json' \
  -F 'task_id=task20261102' \
  -F 'user_id=测试者01' \
  -F 'device_type=1' \
  -F 'scores_csv=<scores/example_scores.csv'
```

请求只有四类信息：`task_id`、`user_id`、`device_type` 和 CSV 文本字段
`scores_csv`。
`task20261102` 是通用任务示例；当前去混响页面使用自己的任务 ID `dereverb28v1`。

页面每次发送当前 7 条批次中已打分的行。中途暂存的 `checkpoint` 可以只包含
部分候选评分；先前暂存失败的已完成批次会作为独立请求补传。完成一批时，
页面先尝试向暂存表单发送该批 CSV 文本，再向原通知表单 `mpqgvpvo`
发送累计 JSON 和名为 `upload` 的 CSV 文件附件；暂存失败也不会阻止整批提交。
如果旧表单也拒绝附件，页面会回退到原来的纯 JSON 提交，并下载 CSV 备份。
原表单返回成功只说明 Formspree 已接收，邮箱是否收到仍取决于表单的通知设置。

## 归档前校验

Formspree 只接收表单字段。之后从 Formspree 导出并写入公开 `scores/`
目录时，归档程序应对 `scores_csv` 执行以下校验：

1. 请求包含且仅包含上述四个文本字段。
2. `task_id` 为 1～20 位英文字母或数字，正则为 `^[A-Za-z0-9]{1,20}$`。
3. `user_id` 为 1～20 位中文、英文字母或数字，正则为
   `^[A-Za-z0-9\u3400-\u9fff]{1,20}$`。
4. `device_type` 可解析为正整数。当前页面约定：`1` 为耳机，`2` 为扬声器，
   `3` 为其他设备。
5. `scores_csv` 可按 UTF-8 CSV 解析，至少包含 `task_id`、`user_id`、
   `session_id`、`submitted_at`、`sample_id`、`candidate_key`、`score`
   和 `scale_max`。允许其他任务专属列。当前去混响页面仍使用旧列名
   `listener_id` 表示 `user_id`，校验器兼容该别名。
6. **逐行**比较 CSV 的 `task_id` 和 `user_id`（或 `listener_id`）与外层表单字段。
   只要有一行属于其他任务或用户，就拒绝整次提交；一份 CSV 不能混装多个任务。
7. `score` 必须是有限数字，范围为 `0` 到正数 `scale_max`；`checkpoint`
   允许仅有已打分的行。
8. `sample_id` 和 `candidate_key` 必须非空、各不超过 128 个字符。当前四字段
   请求**没有提供权威样本或候选清单**，所以通用暂存服务无法判断这些 ID
   是否真实存在，也不能因为一个新任务没有清单就拒绝暂存。
9. 同一候选评分由 `(task_id, user_id, sample_id, candidate_key)` 确定。
   `candidate_position` 只是页面随机显示的 A～J 位置；`session_id` 用于追溯访问，
   不会把同一用户的重复评分拆开。保留原始提交，并以 **Formspree 服务端接收时间**
   和提交 ID 选择最新评分；浏览器写入的 `submitted_at` 只作审计信息。

上述校验发生在归档步骤，时间上晚于 Formspree 接收表单。仓库提供了可运行的
通用校验器：

```bash
python -m scores.validate_scores --task-id task20261102 \
  --user-id 测试者01 --device-type 1 --csv scores/example_scores.csv
```

校验器不限定任务 ID；新增主观任务**不必登记清单**即可暂存。如果任务方
以后单独提供了权威清单，后续针对该任务的分析可以再检查 `sample_id` 和
`candidate_key` 是否存在。可选清单的结构见[示例](example_task_manifest.json)：

```bash
python -m scores.validate_scores --task-id task20261102 \
  --user-id 测试者01 --device-type 1 --csv scores/example_scores.csv \
  --manifest scores/example_task_manifest.json
```

显式提供去混响清单时，校验器也支持原有的 `study`、`trials`、`tracks` 结构，
并把公开播放器 `reference` 排除在评分候选之外。

## 可选的 JSON 接收服务

仓库还保留了 `staging_server.py`，它是早期 JSON 请求格式的自托管接收示例：

```json
{"task_id":"task20261102","user_id":"测试者01","device_type":1,"scores_csv":"..."}
```

已发布页面**没有使用**这个 JSON 服务。若采用它，需要自行部署公开 HTTPS
地址并配置仓库写入凭据。当前 Formspree 收到的表单数据也不会自动进入 GitHub；
仍需部署一个持有受保护凭据的同步任务，完成导出、校验和提交。
仓库已包含定时同步工作流；启用步骤见[同步说明](SYNC.zh-CN.md)。

# Staging score API

## Request

Use `POST` with `Content-Type: application/json`:

```json
{
  "task_id": "task20261102",
  "user_id": "listenerA01",
  "device_type": 1,
  "scores_csv": "listener_id,session_id,task_id,round,submission_kind,submitted_at,dataset,sample_id,candidate_position,candidate_key,score,scale_max,audio_file,audio_url,audio_sha256,reference_file\n..."
}
```

The response should be a JSON object with HTTP `2xx`, for example:

```json
{"ok": true, "submission_id": "staging-20261102-0001"}
```

## Validation

1. Reject unknown or missing top-level fields.
2. Validate `task_id` with `^[A-Za-z0-9]{1,20}$`.
3. Validate `user_id` with `^[A-Za-z0-9\u3400-\u9fff]{1,20}$`.
4. Validate `device_type` as a JSON integer greater than zero.
5. Decode `scores_csv` as UTF-8 and require the header shown in
   [`example_scores.csv`](example_scores.csv).
6. Validate every score as a finite number from `0` to `100`; allow partial
   rows for `checkpoint` submissions.
7. Keep `task_id`, `user_id`, and `session_id` with every archived row.
8. Treat repeated requests as upserts by `(task_id, user_id, session_id,
   sample_id, candidate_key)` and retain the latest `submitted_at` value.

The page's current task value is `dereverb28v1`; that value is only an example
of a valid task ID and is not part of the API format.

## Reference implementation

The repository includes `staging_server.py`, which exposes `POST /stage` and
writes accepted requests to `scores/inbox/`. Run it beside the checkout:

```bash
python scores/staging_server.py --bind 0.0.0.0 --port 8787
```

Set `P808_STAGING_ENDPOINT=https://your-host.example/stage` in the published
page configuration. Set `P808_AUTO_COMMIT=1` only when the server checkout has
a restricted deploy key and should commit each accepted request to this
repository.

# Staging score upload

[中文版](STAGING_API.zh-CN.md)

The listening page sends progress to the separate Formspree endpoint
`https://formspree.io/f/mjyypvzy`. This is a staging inbox, not the GitHub
score archive. Disable email notifications for this form in Formspree; the
completed batch uses the existing notification form.

## Request

Use `POST` with `multipart/form-data`; the browser generates the boundary:

```bash
curl -X POST 'https://formspree.io/f/mjyypvzy' \
  -H 'Accept: application/json' \
  -F 'task_id=task20261102' \
  -F 'user_id=测试者01' \
  -F 'device_type=1' \
  -F 'upload=@scores/example_scores.csv;type=text/csv'
```

The four fields are `task_id`, `user_id`, `device_type`, and the CSV file
`upload`. `task20261102` is a generic example; the current dereverberation
page uses its own task ID, `dereverb28v1`.

The current page uploads the cumulative scores already entered by the
listener. A `checkpoint` file may contain only some candidate scores. It
uploads the completed batch too, then sends the batch to the original
notification form.

## Validation

Formspree receives the form and attachment. The later archive job should
validate the downloaded CSV before committing it to public `scores/`:

1. Require exactly the four form fields shown above and a `.csv` attachment.
2. Validate `task_id` with `^[A-Za-z0-9]{1,20}$`.
3. Validate `user_id` with `^[A-Za-z0-9\u3400-\u9fff]{1,20}$`.
4. Parse `device_type` as a positive integer. This page sends `1` for
   headphones, `2` for speakers, and `3` for other devices.
5. Decode the attachment as UTF-8 CSV. Require `task_id`, `user_id`,
   `session_id`, `submitted_at`, `sample_id`, `candidate_key`, `score`, and
   `scale_max`. Additional task-specific columns are allowed. The existing
   dereverberation page uses `listener_id` as a legacy alias for `user_id`.
6. Match the CSV `task_id` and `user_id` (or legacy `listener_id`) on
   **every** row to the form fields.
   Reject the entire attachment if one row has another task or listener ID;
   one CSV attachment cannot contain multiple tasks.
7. Validate every score as a finite number from `0` to its positive
   `scale_max`; partial rows are allowed for `checkpoint` submissions.
8. Load the server-side manifest registered for `task_id` in
   [`task_registry.json`](task_registry.json). A generic task manifest has
   `task_id`, `samples`, and each sample's `candidates`, as in
   [`example_task_manifest.json`](example_task_manifest.json). The existing
   dereverberation manifest uses `study`, `trials`, and `tracks` instead; its
   public `reference` player is not a scored candidate. Unknown sample or
   candidate IDs reject the entire attachment. Where a manifest provides
   audio files, SHA-256 values, reference files, or dataset names, check
   those additional CSV columns too.
9. A scored item is identified by `(task_id, user_id, sample_id,
   candidate_key)`. `candidate_position` is only the anonymous A-J display
   position. `session_id` records a visit but does not split one listener's
   repeated ratings. Keep raw submissions, then select the latest row using
   Formspree's server receipt time and submission ID; the browser's
   `submitted_at` is audit metadata, not the authority for ordering.

These checks run during the authenticated archive step, after Formspree has
accepted the upload. Formspree itself does not know the task manifest. A
reference validator is included:

```bash
python -m scores.validate_scores --task-id task20261102 \
  --user-id 测试者01 --device-type 1 --csv scores/example_scores.csv
```

Task IDs are not hard-coded in the validator. Each additional subjective
study needs a registered manifest with a matching `task_id` value. The
dereverberation manifest's existing `study` field remains supported.

## Alternative JSON receiver

The repository also contains `staging_server.py`, an optional self-hosted
receiver for the earlier JSON request format:

```json
{"task_id":"task20261102","user_id":"listenerA01","device_type":1,"scores_csv":"..."}
```

It is not used by the published page. It would need a public HTTPS host and
repository write credentials before it could provide automatic GitHub
archiving. Formspree uploads likewise require a separate authenticated sync
job before files appear in this repository.

# Staging score upload

[中文版](STAGING_API.zh-CN.md)

The listening page sends progress to the separate Formspree endpoint
`https://formspree.io/f/mjyypvzy`. This is a staging inbox, not the GitHub
score archive. Disable email notifications for this form in Formspree; the
completed batch uses the existing notification form.
This form rejected file attachments with `File Uploads Not Permitted`, so the
CSV is sent as a text field.

## Request

Use `POST` with `multipart/form-data`; all four fields are text, and the browser
generates the boundary:

```bash
curl -X POST 'https://formspree.io/f/mjyypvzy' \
  -H 'Accept: application/json' \
  -F 'task_id=task20261102' \
  -F 'user_id=测试者01' \
  -F 'device_type=1' \
  -F 'scores_csv=<scores/example_scores.csv'
```

The four fields are `task_id`, `user_id`, `device_type`, and the CSV text field
`scores_csv`. `task20261102` is a generic example; the current dereverberation
page uses its own task ID, `dereverb28v1`.

The current page sends scored rows from the current seven-sample batch. A
`checkpoint` may contain only some candidate scores. Completed batches that
previously failed staging are retried as separate seven-sample submissions.
On batch completion, the page attempts staging, then sends the complete
cumulative JSON plus a CSV file attachment named `upload` to the original
notification form `mpqgvpvo` even if staging fails. If that form rejects file
uploads, the page retries with the original JSON-only request and downloads
a CSV backup. A successful response confirms receipt by Formspree; email
delivery depends on the form's notification settings.

## Validation

Formspree receives the form fields. The later archive job should validate
`scores_csv` before committing it to public `scores/`:

1. Require exactly the four text fields shown above.
2. Validate `task_id` with `^[A-Za-z0-9]{1,20}$`.
3. Validate `user_id` with `^[A-Za-z0-9\u3400-\u9fff]{1,20}$`.
4. Parse `device_type` as a positive integer. This page sends `1` for
   headphones, `2` for speakers, and `3` for other devices.
5. Decode `scores_csv` as UTF-8 CSV. Require `task_id`, `user_id`,
   `session_id`, `submitted_at`, `sample_id`, `candidate_key`, `score`, and
   `scale_max`. Additional task-specific columns are allowed. The existing
   dereverberation page uses `listener_id` as a legacy alias for `user_id`.
6. Match the CSV `task_id` and `user_id` (or legacy `listener_id`) on
   **every** row to the form fields.
   Reject the entire submission if one row has another task or listener ID;
   one CSV cannot contain multiple tasks.
7. Validate every score as a finite number from `0` to its positive
   `scale_max`; partial rows are allowed for `checkpoint` submissions.
8. Require nonempty `sample_id` and `candidate_key` values of at most 128
   characters. The four-field request provides no authoritative sample or
   candidate list, so the staging service **cannot** check whether those
   IDs exist and must not reject an otherwise valid new task for lacking a
   manifest.
9. A scored item is identified by `(task_id, user_id, sample_id,
   candidate_key)`. `candidate_position` is only the anonymous A-J display
   position. `session_id` records a visit but does not split one listener's
   repeated ratings. Keep raw submissions, then select the latest row using
   Formspree's server receipt time and submission ID; the browser's
   `submitted_at` is audit metadata, not the authority for ordering.

These checks run during the archive step, after Formspree has accepted the
form. A reference validator for the generic checks is included:

```bash
python -m scores.validate_scores --task-id task20261102 \
  --user-id 测试者01 --device-type 1 --csv scores/example_scores.csv
```

Task IDs are not hard-coded, and no manifest registration is needed to stage
a new subjective study. If a task owner separately provides an authoritative
manifest, a later task-specific analysis can additionally check whether
`sample_id` and `candidate_key` exist. The optional manifest format is shown
in [`example_task_manifest.json`](example_task_manifest.json):

```bash
python -m scores.validate_scores --task-id task20261102 \
  --user-id 测试者01 --device-type 1 --csv scores/example_scores.csv \
  --manifest scores/example_task_manifest.json
```

The dereverberation manifest's existing `study`, `trials`, and `tracks`
fields are also supported when one is explicitly supplied. The public
`reference` player is then excluded from scored candidates.

## Alternative JSON receiver

The repository also contains `staging_server.py`, an optional self-hosted
receiver for the earlier JSON request format:

```json
{"task_id":"task20261102","user_id":"listenerA01","device_type":1,"scores_csv":"..."}
```

It is not used by the published page. It would need a public HTTPS host and
repository write credentials before it could provide automatic GitHub
archiving. Formspree submissions likewise require a separate authenticated
sync job before scores appear in this repository.

The repository includes a scheduled sync workflow. Configure its Formspree
read-only API key as a GitHub Actions secret; see [sync setup](SYNC.zh-CN.md).

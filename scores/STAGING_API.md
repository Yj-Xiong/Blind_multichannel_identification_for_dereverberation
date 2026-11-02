# Staging score upload

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
  -F 'user_id=listenerA01' \
  -F 'device_type=1' \
  -F 'upload=@scores/example_scores.csv;type=text/csv'
```

The four fields are `task_id`, `user_id`, `device_type`, and the CSV file
`upload`. The task ID is not tied to dereverberation; the current page uses
`dereverb28v1` as its task value.

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
5. Decode the attachment as UTF-8 and require the header shown in
   [`example_scores.csv`](example_scores.csv).
6. Match `task_id` and `listener_id` on every CSV row to the form fields.
7. Validate every score as a finite number from `0` to its positive
   `scale_max`; partial rows are allowed for `checkpoint` submissions.
8. Validate sample and candidate IDs against the registered task before
   publishing. Deduplicate repeated submissions by task, user, session,
   sample, candidate, and timestamp.

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

# Public listening scores

This directory is the public archive target for subjective listening results.
It is intentionally kept in this repository and is not copied to a private
repository.

The active staging form accepts four multipart fields:

- `task_id`: English letters and digits only, 1 to 20 characters.
- `user_id`: Chinese characters, English letters, or digits, 1 to 20 characters.
- `device_type`: positive integer. The current page uses `1` for headphones,
  `2` for speakers, and `3` for other devices.
- `scores_csv`: UTF-8 CSV text containing the scored rows. This Formspree
  form does not permit file attachments.

`checkpoint` submissions may contain partial rows. A completed batch is sent
to the notification endpoint separately. The Formspree inbox does not write
to this directory automatically; an authenticated sync job is still required.

See [`STAGING_API.md`](STAGING_API.md),
[`STAGING_API.zh-CN.md`](STAGING_API.zh-CN.md), and
[`example_scores.csv`](example_scores.csv).
See [`SYNC.zh-CN.md`](SYNC.zh-CN.md) for the GitHub Actions sync setup.
The JSON example is for the optional self-hosted receiver.
Run `validate_scores.py` on the CSV before importing rows. The core CSV schema
is task-agnostic; extra task-specific columns are allowed. A task manifest is
optional and only enables additional sample/candidate checks when supplied
separately. Repeated ratings of the same candidate are keyed by task,
listener, sample, and candidate, then resolved by server receipt time.

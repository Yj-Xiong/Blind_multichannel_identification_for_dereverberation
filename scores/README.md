# Public listening scores

This directory is the public archive target for subjective listening results.
It is intentionally kept in this repository and is not copied to a private
repository.

The active staging form accepts four multipart fields:

- `task_id`: English letters and digits only, 1 to 20 characters.
- `user_id`: Chinese characters, English letters, or digits, 1 to 20 characters.
- `device_type`: positive integer. The current page uses `1` for headphones,
  `2` for speakers, and `3` for other devices.
- `upload`: UTF-8 CSV file containing the scored rows.

`checkpoint` submissions may contain partial rows. A completed batch is sent
to the notification endpoint separately. The Formspree inbox does not write
to this directory automatically; an authenticated sync job is still required.

See [`STAGING_API.md`](STAGING_API.md) and [`example_scores.csv`](example_scores.csv).
The JSON example is for the optional self-hosted receiver.

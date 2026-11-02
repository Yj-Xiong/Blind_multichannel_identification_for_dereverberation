# Public listening scores

This directory is the public archive target for subjective listening results.
It is intentionally kept in this repository and is not copied to a private
repository.

The staging endpoint accepts one JSON object with these fields:

- `task_id`: English letters and digits only, 1 to 20 characters.
- `user_id`: Chinese characters, English letters, or digits, 1 to 20 characters.
- `device_type`: positive integer. The current page uses `1` for headphones,
  `2` for speakers, and `3` for other devices.
- `scores_csv`: UTF-8 CSV text containing the scored rows.

`checkpoint` submissions may contain partial rows. A completed batch is sent
to the notification endpoint separately. The public archive should preserve
the original request and a normalized CSV for later aggregation.

See [`STAGING_API.md`](STAGING_API.md), [`staging_request.example.json`](staging_request.example.json),
and [`example_scores.csv`](example_scores.csv).

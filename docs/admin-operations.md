# Owner operations

Migration `migrations/0003_admin_operations.sql` adds the private operational
summary, contact follow-up records and maintenance tasks to `CONTENT_DB`.
Apply it through the existing Wrangler D1 migration workflow before publishing
the owner UI. Reapplying the migration preserves existing counters and records.

## Overview and measured values

`GET /api/admin/overview` requires the existing owner session and adds
`operations` without changing visitor statistics or the content manager.
If the new schema is unavailable, the base dashboard remains usable;
`operations.available` is false and unavailable numbers are `null` rather than
fabricated zeros. An applied empty schema correctly reports zero events.

- `security`: `turnstileBlocked`, `rateLimited`, `suspiciousRequests` and
  `trackingSince`. These are aggregate counts since migration enablement.
  Turnstile rejection means the configured contact gate rejected a submission.
  Rate limiting covers actual HTTP 429 responses on login, contact and Cia's
  guide. Suspicious requests count rejected cross-origin API writes and contact
  honeypot submissions. Ordinary form validation errors are not attack events.
- `health.databaseBytes`: D1's actual query `meta.size_after` value; `null` if
  the binding does not supply it. `databaseStatus` is the latest successful query
  probe (`connected`) or `unavailable`; `checkedAt` timestamps that probe.
- `health.storageBytes`: the sum of managed `content_media.byte_size` metadata.
  This is managed media storage, not the entire hosting account's usage.
  `reservedBytes` separately counts active and expired multipart reservations;
  expired uploads retain reservation until their R2 parts are aborted.
  `storageLimitBytes` is the existing 8 GiB owner-upload cap. Static bundled
  artwork and external assets are outside this measure.
- `health.events`: the count of recorded security blocks, configured mail API
  outcomes and contact/task changes since tracking began. It is not the visitor
  total and does not imply per-event payload logs. `uptimePercent` is always
  `null`; no independent uptime monitor is configured.
- `email`: actual mail API `sent`/`failed` totals, `lastDeliveryAt`,
  `trackingSince`, full-table status counts and the latest 100 contacts.
  `lastDeliveryAt` is the last successful provider API acceptance, not verified
  inbox delivery. Missing email configuration does not increment failed sends.
- `tasks`: the latest 200 maintenance records. Nothing is seeded as though the
  owner created it. Archived records remain in D1.

The counters never contain IPs, request paths, headers, credentials, attack
payloads or conversation transcripts. Only intentional, validated contact
submissions store the provided name, reply email and message in the private
owner inbox. No historical contact/mail records are backfilled. Analytics reset
does not reset these operational records.

## Contact persistence and follow-up

The public contact API keeps its existing anti-spam checks and limiter. Only
after successful validation, Turnstile and rate limiting does it save a `NEW`
contact, **before** calling Resend/SendGrid. The result updates `mailStatus` to
`sent`, `failed` or `unconfigured`. An interrupted request remains internal
`pending`; the JSON includes `deliveryPending: true` with `mailStatus:
"unconfigured"` so the UI can label the outcome unknown instead of claiming a
delivery or a failure. Database telemetry failures never replace the existing
contact API response; forwarding still works during a D1 outage, but that
submission cannot then be guaranteed present in the inbox.

`PATCH /api/admin/contacts/:id`, body `{ "status": "READ" }`, manually tags a
record `NEW`, `READ`, `REPLIED` or `ARCHIVED` and returns `{ "contact": ... }`.
The owner can restore any archived record by setting its status again. This
does not send a reply email. `REPLIED` is a manual follow-up label only.

## Maintenance tasks

`POST /api/admin/tasks`, body `{ "title": "Update CV" }`, creates a task with
`status: "OPEN"` and returns HTTP 201 with `{ "task": ... }`.

`PATCH /api/admin/tasks/:id` accepts a title, status or both and returns the
updated task. Status is `OPEN`, `DONE` or `ARCHIVED`; changing back to `OPEN`
restores a completed/archived task. Task titles must be 1–240 characters after
trimming, with no control characters. No deletion endpoint exists.

All mutations require the same `HttpOnly`, `Secure`, `SameSite=Strict` owner
session as content management, same-origin requests, UUID record IDs and JSON
bodies no larger than 8 KiB. Unknown fields and invalid statuses receive HTTP
422. Missing records receive 404, missing sessions 401, cross-origin writes 403,
unsupported methods 405, and unavailable operations storage 503. Successful
changes increment the event counter; saving an unchanged state does not.

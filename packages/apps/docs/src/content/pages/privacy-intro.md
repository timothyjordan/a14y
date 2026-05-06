---
title: Privacy · a14y
description: Privacy policy for a14y.dev, the a14y CLI, and the Chrome extension. What we collect, what we don't, and how to opt out.
---

## What we collect

All telemetry goes to a single Google Analytics 4 property, anonymized, with
Google Signals and ad personalization disabled. We never set or send a user
identifier; CLI and extension events are tied to a random UUID generated
locally on first run.

### On a14y.dev

Standard GA4 web measurement: page views, referrers, approximate region (IP
is anonymized at ingest), and clicks to outbound destinations grouped into
a fixed enum (`github` / `npm` / `chrome_web_store`
/ `other`). GA4 sets a `_ga` cookie. The site honors
your browser's *Do Not Track* header. If it's set, no GA script is
loaded. You can also opt out for this site explicitly with the toggle below.
That flips a flag in `localStorage` and the GA script stops loading
on every subsequent visit.

Each CLI invocation and each browser-extension audit also generates a
random per-run id (`run_id`) that is attached to every event from that run.
It exists only to group events from the same audit together for analytics
and is not retained anywhere on your machine.

### From the CLI

The CLI sends an event for each of:

- `cli_command_invoked`: the command name (`check` / `scorecards`), output format, mode, scorecard version, and `run_id`.
- `cli_run_completed`: bucketed score (e.g. `76-100`), bucketed page count, bucketed run duration, bucketed counts of failed, warned, and errored checks, and `run_id`. No URL.
- `cli_error`: the error class name (no message, no stack trace), the phase it happened in, and `run_id`.
- `scorecard_check_result`: one event per scorecard check that ran. Carries the stable check id (e.g. `html.canonical-link`), the resulting status (`pass` / `fail` / `warn` / `error` / `na`), the scorecard version, the surface (`cli`), and `run_id`. For checks that run on every crawled page, also includes aggregate `failed_pages` and `total_pages` counts. No URL, no per-page outcomes.

### From the Chrome extension

The extension sends an event for each of:

- `ext_installed`: whether the install was a fresh install or an update.
- `ext_audit_started`: mode (`page` / `site`), scorecard version, and `run_id`. No URL.
- `ext_audit_completed`: bucketed score, bucketed page count, bucketed duration, and `run_id`. No URL.
- `ext_audit_error`: error class name, phase, and `run_id`.
- `ext_settings_changed`: the name of the setting that changed (e.g. `maxPages`). No values. We deliberately do *not* track changes to the telemetry toggle itself.
- `scorecard_check_result`: same shape as the CLI version, with `surface` set to `ext`.

## What we don't collect

- The URLs you audit, or any part of them.
- The content of any page the CLI or extension fetches.
- Per-page check outcomes (page-level checks are rolled up into a single status per check id, plus aggregate counts).
- Your real IP address (anonymized at ingest by GA4).
- Any user-agent string detail beyond OS family.
- Names, email addresses, or anything that could tie events to a real person.
- Stack traces, error messages, or any free-text content from errors.

## How to opt out

### Website

Set your browser's *Do Not Track* header (every browser supports
this in privacy settings). We honor it and never load the GA script.
Or use the in-page toggle below; it persists in `localStorage`
on this site only.

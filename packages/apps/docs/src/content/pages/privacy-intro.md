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

### From the CLI

The CLI sends an event for each of:

- `cli_command_invoked`: the command name (`check` / `scorecards`), output format, mode, and scorecard version.
- `cli_run_completed`: bucketed score (e.g. `76-100`), bucketed page count, bucketed run duration, bucketed counts of failed, warned, and errored checks. No URL, no per-check details.
- `cli_error`: the error class name (no message, no stack trace) and the phase it happened in.

### From the Chrome extension

The extension sends an event for each of:

- `ext_installed`: whether the install was a fresh install or an update.
- `ext_audit_started`: mode (`page` / `site`) and scorecard version. No URL.
- `ext_audit_completed`: bucketed score, bucketed page count, bucketed duration. No URL.
- `ext_audit_error`: error class name and phase.
- `ext_settings_changed`: the name of the setting that changed (e.g. `maxPages`). No values. We deliberately do *not* track changes to the telemetry toggle itself.

## What we don't collect

- The URLs you audit, or any part of them.
- The content of any page the CLI or extension fetches.
- Per-check scorecard details. Only bucketed totals.
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

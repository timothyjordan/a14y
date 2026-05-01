---
title: Privacy · a14y (tail)
description: Privacy policy continued — system-wide opt-out, CLI, extension, retention, contact, changelog.
---

For a system-wide opt-out, install Google's
[Google Analytics opt-out browser add-on](https://tools.google.com/dlpage/gaoptout).

### CLI

Any of the following disables CLI telemetry. The first match wins:

- Pass `--no-telemetry` to a single command.
- Set the env var `A14Y_TELEMETRY=0`.
- Set `"telemetryEnabled": false` in `~/.a14y/config.json` (the CLI creates this file on first run).
- Set `DO_NOT_TRACK=1` or run with `CI=true`. Both auto-disable.

### Chrome extension

Open the extension's **Options** page (right-click the action
icon, then Options) and toggle off *Send anonymous usage data*. Or click
*Turn off* on the popup banner the first time you open the popup.
Both write the same flag in `chrome.storage.local`; no further
events leave your machine until you re-enable.

## Provider and data sharing

All events go to Google Analytics 4. Google's privacy policy is at
[policies.google.com/privacy](https://policies.google.com/privacy);
Google's overview of GA data controls is at
[support.google.com/analytics/answer/6004245](https://support.google.com/analytics/answer/6004245).
Data resides on Google's global infrastructure. We have not enabled Google
Signals or ad personalization on the property.

## What the extension still stores locally

The Chrome extension uses `chrome.storage.local` to remember
the last twenty audit runs: URL, scorecard version, timestamp, pass/fail
summary. That history stays on your device, is visible on the extension's
report page, and is never sent anywhere. Uninstalling the extension wipes
`chrome.storage.local`.

## Data retention

The GA4 property is configured for the longest standard retention window
(14 months). Older events are deleted by Google automatically.

## Contact

Questions, concerns, or security reports can go to
[agentreadability@gmail.com](mailto:agentreadability@gmail.com).

## Changelog

- **v2 ({{LAST_UPDATED}}):** introduced opt-out anonymous telemetry across the website, CLI, and Chrome extension.
- **v1:** "no telemetry, no third parties." Superseded by v2.

Last updated: {{LAST_UPDATED}}.

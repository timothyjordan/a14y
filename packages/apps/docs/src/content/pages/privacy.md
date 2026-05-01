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

<ul class="privacy-page">
  <li><code>cli_command_invoked</code>: the command name (<code>check</code> / <code>scorecards</code>), output format, mode, and scorecard version.</li>
  <li><code>cli_run_completed</code>: bucketed score (e.g. <code>76-100</code>), bucketed page count, bucketed run duration, bucketed counts of failed, warned, and errored checks. No URL, no per-check details.</li>
  <li><code>cli_error</code>: the error class name (no message, no stack trace) and the phase it happened in.</li>
</ul>

### From the Chrome extension

The extension sends an event for each of:

<ul class="privacy-page">
  <li><code>ext_installed</code>: whether the install was a fresh install or an update.</li>
  <li><code>ext_audit_started</code>: mode (<code>page</code> / <code>site</code>) and scorecard version. No URL.</li>
  <li><code>ext_audit_completed</code>: bucketed score, bucketed page count, bucketed duration. No URL.</li>
  <li><code>ext_audit_error</code>: error class name and phase.</li>
  <li><code>ext_settings_changed</code>: the name of the setting that changed (e.g. <code>maxPages</code>). No values. We deliberately do <em>not</em> track changes to the telemetry toggle itself.</li>
</ul>

## What we don't collect

<ul class="privacy-page">
  <li>The URLs you audit, or any part of them.</li>
  <li>The content of any page the CLI or extension fetches.</li>
  <li>Per-check scorecard details. Only bucketed totals.</li>
  <li>Your real IP address (anonymized at ingest by GA4).</li>
  <li>Any user-agent string detail beyond OS family.</li>
  <li>Names, email addresses, or anything that could tie events to a real person.</li>
  <li>Stack traces, error messages, or any free-text content from errors.</li>
</ul>

## How to opt out

### Website

Set your browser's *Do Not Track* header (every browser supports
this in privacy settings). We honor it and never load the GA script.
Or use the in-page toggle below; it persists in `localStorage`
on this site only.

<p>
  <button
    type="button"
    id="ga-opt-out-toggle"
    class="btn btn--ghost"
    data-on-label="Disable analytics on this site"
    data-off-label="Enable analytics on this site"
  >
    Disable analytics on this site
  </button>
  <span id="ga-opt-out-status" class="ga-opt-out-status" aria-live="polite"></span>
</p>

For a system-wide opt-out, install Google's
[Google Analytics opt-out browser add-on](https://tools.google.com/dlpage/gaoptout).

### CLI

Any of the following disables CLI telemetry. The first match wins:

<ul class="privacy-page">
  <li>Pass <code>--no-telemetry</code> to a single command.</li>
  <li>Set the env var <code>A14Y_TELEMETRY=0</code>.</li>
  <li>Set <code>"telemetryEnabled": false</code> in <code>~/.a14y/config.json</code> (the CLI creates this file on first run).</li>
  <li>Set <code>DO_NOT_TRACK=1</code> or run with <code>CI=true</code>. Both auto-disable.</li>
</ul>

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

<ul class="privacy-page">
  <li><strong>v2 ({{LAST_UPDATED}}):</strong> introduced opt-out anonymous telemetry across the website, CLI, and Chrome extension.</li>
  <li><strong>v1:</strong> "no telemetry, no third parties." Superseded by v2.</li>
</ul>

<p style="margin-top:32px;font-size:13px;color:var(--text-subtle);font-family:var(--font-mono);">Last updated: {{LAST_UPDATED}}.</p>

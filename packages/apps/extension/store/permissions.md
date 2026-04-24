# Permission justifications

Chrome Web Store asks for a justification per declared permission.
Paste these directly into the upload form's "Privacy practices" tab.

---

## `storage`

**Justification:**

The extension uses `chrome.storage.local` to persist the last 20 audit
runs (URL, scorecard version, timestamp, pass/fail summary) so reopening
the popup mid-audit immediately shows live progress, and so the report
page can display run history after a restart. Nothing is transmitted
off-device.

## `activeTab`

**Justification:**

Reads the URL of the currently active tab so "Check this page" defaults
to auditing the page the user is looking at. Only the URL is accessed;
page contents are fetched by the crawler independently via a normal
HTTP request, not via tab content scripts.

## `alarms`

**Justification:**

Schedules short periodic keepalive pings during long site crawls. MV3
service workers have an idle-timeout that can terminate a crawl
mid-run; the alarm wakes the SW before that timeout fires so the
offscreen document can finish a multi-minute audit.

## `offscreen`

**Justification:**

Runs the audit engine in an offscreen document so long crawls survive
the service-worker 30-second lifetime cap. The offscreen doc has no UI;
it exists purely to host the core scoring logic in a context Chrome
won't kill unpredictably.

## `host_permissions: <all_urls>`

**Justification:**

The "Scan whole site" feature crawls from the entry URL following
same-origin links — the user explicitly chooses the origin to audit, so
the extension needs permission to fetch pages on any origin the user
points it at. No data is collected, transmitted, or retained beyond the
run summary in `chrome.storage.local` (see the `storage` justification).
Audits are read-only; the extension never submits forms or writes to the
sites it audits.

Because this mirrors behavior a user can achieve by opening those pages
in a tab themselves, the intent is "act on any site the user asks me
to," not "observe all browsing." Nothing runs in the background; audits
start only when the user clicks one of the two buttons in the popup.

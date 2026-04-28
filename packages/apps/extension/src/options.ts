/// <reference types="chrome" />

interface Settings {
  maxPages: number;
  concurrency: number;
  politeDelayMs: number;
  telemetryEnabled?: boolean;
  telemetryNoticeShown?: boolean;
}

const DEFAULTS: Settings = {
  maxPages: 500,
  concurrency: 8,
  politeDelayMs: 250,
  telemetryEnabled: true,
};
const STORAGE_KEY = 'a14y:settings';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const maxPages = $<HTMLInputElement>('max-pages');
const concurrency = $<HTMLInputElement>('concurrency');
const politeDelay = $<HTMLInputElement>('polite-delay');
const telemetry = $<HTMLInputElement>('telemetry-enabled');
const saveBtn = $<HTMLButtonElement>('save');
const savedStatus = $<HTMLElement>('saved-status');

async function load() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const stored = (data[STORAGE_KEY] as Settings | undefined) ?? {};
  const s: Settings = { ...DEFAULTS, ...stored };
  maxPages.value = String(s.maxPages);
  concurrency.value = String(s.concurrency);
  politeDelay.value = String(s.politeDelayMs);
  telemetry.checked = s.telemetryEnabled !== false;
}

saveBtn.addEventListener('click', async () => {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const stored = (data[STORAGE_KEY] as Settings | undefined) ?? {};
  const next: Settings = {
    ...stored,
    maxPages: parseInt(maxPages.value, 10) || DEFAULTS.maxPages,
    concurrency: parseInt(concurrency.value, 10) || DEFAULTS.concurrency,
    politeDelayMs: parseInt(politeDelay.value, 10) || DEFAULTS.politeDelayMs,
    telemetryEnabled: telemetry.checked,
  };

  // Tell the background to track non-telemetry-toggle changes BEFORE we
  // persist (so a flip to telemetryEnabled=false doesn't suppress the
  // events about the same change). The telemetry toggle itself is not
  // tracked — the user may be opting out, and tracking their opt-out
  // would be a violation of consent.
  const fired: string[] = [];
  if (next.maxPages !== stored.maxPages) fired.push('maxPages');
  if (next.concurrency !== stored.concurrency) fired.push('concurrency');
  if (next.politeDelayMs !== stored.politeDelayMs) fired.push('politeDelayMs');
  for (const field of fired) {
    chrome.runtime.sendMessage({
      type: 'telemetry-event',
      name: 'ext_settings_changed',
      props: { field },
    });
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  savedStatus.textContent = 'Saved';
  setTimeout(() => (savedStatus.textContent = ''), 1500);
});

void load();

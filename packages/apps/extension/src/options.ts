/// <reference types="chrome" />

interface Settings {
  maxPages: number;
  concurrency: number;
  politeDelayMs: number;
}

const DEFAULTS: Settings = { maxPages: 500, concurrency: 8, politeDelayMs: 250 };
const STORAGE_KEY = 'a14y:settings';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const maxPages = $<HTMLInputElement>('max-pages');
const concurrency = $<HTMLInputElement>('concurrency');
const politeDelay = $<HTMLInputElement>('polite-delay');
const saveBtn = $<HTMLButtonElement>('save');
const savedStatus = $<HTMLElement>('saved-status');

async function load() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const s: Settings = { ...DEFAULTS, ...(data[STORAGE_KEY] as Settings | undefined) };
  maxPages.value = String(s.maxPages);
  concurrency.value = String(s.concurrency);
  politeDelay.value = String(s.politeDelayMs);
}

saveBtn.addEventListener('click', async () => {
  const s: Settings = {
    maxPages: parseInt(maxPages.value, 10) || DEFAULTS.maxPages,
    concurrency: parseInt(concurrency.value, 10) || DEFAULTS.concurrency,
    politeDelayMs: parseInt(politeDelay.value, 10) || DEFAULTS.politeDelayMs,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: s });
  savedStatus.textContent = 'Saved';
  setTimeout(() => (savedStatus.textContent = ''), 1500);
});

void load();

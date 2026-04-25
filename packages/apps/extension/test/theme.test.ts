import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// theme.ts touches localStorage, document, and window.matchMedia. Stub
// them on the global object before importing so the module-level code
// has what it needs.

interface FakeStorage {
  store: Map<string, string>;
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
  clear: () => void;
}

function makeStorage(): FakeStorage {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
    clear: () => void store.clear(),
  };
}

const fakeStorage = makeStorage();
let prefersDark = false;

beforeEach(() => {
  fakeStorage.clear();
  prefersDark = false;

  // Replace globals on `globalThis` so the module can use them via window/global lookup.
  (globalThis as unknown as { localStorage: FakeStorage }).localStorage = fakeStorage;
  (globalThis as unknown as { window: Window }).window = {
    matchMedia: (q: string) => ({
      matches: q.includes('dark') ? prefersDark : false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
    localStorage: fakeStorage,
  } as unknown as Window;
  (globalThis as unknown as { document: Document }).document = {
    documentElement: {
      _attrs: new Map<string, string>(),
      setAttribute(name: string, value: string) {
        this._attrs.set(name, value);
      },
      getAttribute(name: string) {
        return this._attrs.get(name) ?? null;
      },
      removeAttribute(name: string) {
        this._attrs.delete(name);
      },
    },
  } as unknown as Document;
});

afterEach(() => {
  vi.resetModules();
});

async function importTheme() {
  // Re-import on each test so module state is fresh.
  vi.resetModules();
  return await import('../src/lib/theme');
}

describe('theme.ts (TJ-209)', () => {
  it('getStoredTheme returns null when nothing is stored', async () => {
    const { getStoredTheme } = await importTheme();
    expect(getStoredTheme()).toBeNull();
  });

  it('getStoredTheme returns the stored value when light or dark', async () => {
    fakeStorage.setItem('a14y-theme', 'dark');
    const { getStoredTheme } = await importTheme();
    expect(getStoredTheme()).toBe('dark');
  });

  it('getStoredTheme rejects garbage values', async () => {
    fakeStorage.setItem('a14y-theme', 'auto');
    const { getStoredTheme } = await importTheme();
    expect(getStoredTheme()).toBeNull();
  });

  it('getEffectiveTheme falls back to system preference when nothing stored', async () => {
    prefersDark = true;
    const { getEffectiveTheme } = await importTheme();
    expect(getEffectiveTheme()).toBe('dark');
  });

  it('getEffectiveTheme defaults to light when neither stored nor system-dark', async () => {
    prefersDark = false;
    const { getEffectiveTheme } = await importTheme();
    expect(getEffectiveTheme()).toBe('light');
  });

  it('stored value beats system preference', async () => {
    prefersDark = true;
    fakeStorage.setItem('a14y-theme', 'light');
    const { getEffectiveTheme } = await importTheme();
    expect(getEffectiveTheme()).toBe('light');
  });

  it('applyTheme sets data-theme attribute and persists to storage', async () => {
    const { applyTheme } = await importTheme();
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(fakeStorage.getItem('a14y-theme')).toBe('dark');
  });

  it('toggleTheme flips between light and dark', async () => {
    const { toggleTheme } = await importTheme();
    expect(toggleTheme()).toBe('dark'); // started in light (no storage, no system-dark)
    expect(toggleTheme()).toBe('light');
    expect(toggleTheme()).toBe('dark');
  });

  it('attachThemeToggle wires click handler and updates aria-pressed', async () => {
    const { attachThemeToggle } = await importTheme();
    const button = {
      _attrs: new Map<string, string>(),
      _listeners: [] as Array<() => void>,
      setAttribute(name: string, value: string) {
        this._attrs.set(name, value);
      },
      getAttribute(name: string) {
        return this._attrs.get(name) ?? null;
      },
      addEventListener(_: string, fn: () => void) {
        this._listeners.push(fn);
      },
    };
    attachThemeToggle(button as unknown as HTMLButtonElement);
    // Initial — light, so aria-pressed reflects "not dark"
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toContain('dark');
    // Simulate click
    button._listeners[0]();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toContain('light');
  });
});

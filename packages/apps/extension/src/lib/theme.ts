// Theme management shared between popup and results pages.
//
// Storage: `localStorage` under key `a14y-theme`. We use localStorage (not
// chrome.storage.local) because it's synchronous — that lets the inline
// pre-paint script in each HTML page set `data-theme` on the document
// element before first paint, eliminating FOUC.
//
// State:
//   - 'light' / 'dark' = explicit user choice; sets data-theme attr
//   - null              = follow system preference (no attr; CSS @media kicks in)
// Toggle cycles light ↔ dark; first click overrides system pref.

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'a14y-theme';

export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function getEffectiveTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Best-effort: a private-mode failure shouldn't break the toggle.
  }
}

export function toggleTheme(): Theme {
  const next: Theme = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

/**
 * Wire a button (typically in the page header) to flip the theme.
 * Updates `aria-pressed` to reflect the active theme so screen readers
 * announce the state change.
 */
export function attachThemeToggle(button: HTMLButtonElement): void {
  const refresh = () => {
    const t = getEffectiveTheme();
    button.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
    button.setAttribute('aria-label', `Switch to ${t === 'dark' ? 'light' : 'dark'} mode`);
  };
  refresh();
  button.addEventListener('click', () => {
    toggleTheme();
    refresh();
  });
}

export type ThemeMode = 'light' | 'dark';

type ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => {
    finished: Promise<void>;
  };
};

const THEME_ANIMATION_MS = 520;

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const savedTheme = localStorage.getItem('theme');
  return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'light';
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof window === 'undefined') return;
  const root = window.document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
}

export function setStoredTheme(theme: ThemeMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('theme', theme);

  const root = window.document.documentElement;
  const doc = window.document as ViewTransitionDocument;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!prefersReducedMotion && typeof doc.startViewTransition === 'function') {
    const transition = doc.startViewTransition(() => {
      applyTheme(theme);
    });
    transition.finished.catch(() => {
      // noop: theme is already applied, this just guards unsupported edge cases
    });
    return;
  }

  // Fallback for browsers without View Transitions support.
  root.classList.add('theme-transitioning');
  applyTheme(theme);
  window.setTimeout(() => {
    root.classList.remove('theme-transitioning');
  }, THEME_ANIMATION_MS);
}

export function toggleStoredTheme(currentTheme: ThemeMode): ThemeMode {
  const nextTheme: ThemeMode = currentTheme === 'dark' ? 'light' : 'dark';
  setStoredTheme(nextTheme);
  return nextTheme;
}

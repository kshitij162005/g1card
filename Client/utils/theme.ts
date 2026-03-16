export type ThemeMode = 'light' | 'dark';

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
  applyTheme(theme);
}

export function toggleStoredTheme(currentTheme: ThemeMode): ThemeMode {
  const nextTheme: ThemeMode = currentTheme === 'dark' ? 'light' : 'dark';
  setStoredTheme(nextTheme);
  return nextTheme;
}

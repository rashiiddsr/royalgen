export type ThemePreference = 'system' | 'light' | 'dark';

export const getSystemTheme = () => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const resolveTheme = (preference: ThemePreference) => {
  if (preference === 'system') {
    return getSystemTheme();
  }
  return preference;
};

export const applyTheme = (preference: ThemePreference) => {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(preference);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.dataset.theme = preference;
};

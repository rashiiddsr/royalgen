import { ThemePreference } from './theme';

const THEME_KEY = 'rgi_theme_preference';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const readCookie = (key: string) => {
  if (typeof document === 'undefined') return null;
  const value = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${key}=`))
    ?.split('=')
    .slice(1)
    .join('=');
  return value ? decodeURIComponent(value) : null;
};

const writeCookie = (key: string, value: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${key}=${encodeURIComponent(value)};path=/;max-age=${ONE_YEAR_SECONDS}`;
};

export const getThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_KEY) ?? readCookie(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
};

export const setThemePreference = (value: ThemePreference) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, value);
  writeCookie(THEME_KEY, value);
};

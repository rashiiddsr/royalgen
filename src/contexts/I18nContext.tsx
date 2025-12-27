import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getLanguagePreference, LanguagePreference, setLanguagePreference } from '../lib/userPreferences';
import { translate, TranslationParams } from '../lib/i18n';

interface I18nContextValue {
  language: LanguagePreference;
  setLanguage: (language: LanguagePreference) => void;
  t: (key: string, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguagePreference>(() => getLanguagePreference());

  useEffect(() => {
    setLanguagePreference(language);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language === 'indonesia' ? 'id' : 'en';
    }
  }, [language]);

  const setLanguage = useCallback((next: LanguagePreference) => {
    setLanguageState(next);
  }, []);

  const t = useCallback(
    (key: string, params?: TranslationParams) => translate(language, key, params),
    [language]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

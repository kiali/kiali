import { GlobalActions } from 'actions/GlobalActions';
import { serverConfig } from 'config';
import { i18n } from 'i18n';
import { store } from 'store/ConfigStore';
import { Language } from 'types/Common';
import { isLanguagePreference, isSupportedLanguage, type ResolvedLanguage } from 'utils/PreferenceValidation';

export type { ResolvedLanguage } from 'utils/PreferenceValidation';
export { isLanguagePreference, isSupportedLanguage } from 'utils/PreferenceValidation';

export const getLanguageLabel = (language: ResolvedLanguage): string => {
  switch (language) {
    case Language.ENGLISH:
      return 'English';
    case Language.SPANISH:
      return 'Español';
    case Language.CHINESE:
      return '中文';
    case Language.KOREAN:
      return '한국어';
  }
};

/** Native-language description shown in the language preference dropdown. */
export const getLanguageDescription = (language: ResolvedLanguage): string => {
  switch (language) {
    case Language.ENGLISH:
      return 'Display the interface in English.';
    case Language.SPANISH:
      return 'Mostrar la interfaz en español.';
    case Language.CHINESE:
      return '以中文显示界面。';
    case Language.KOREAN:
      return '한국어로 인터페이스를 표시합니다.';
  }
};

const matchBrowserLanguage = (locale: string): ResolvedLanguage | undefined => {
  const normalized = locale.toLowerCase();

  if (normalized.startsWith('es')) {
    return Language.SPANISH;
  }

  if (normalized.startsWith('zh')) {
    return Language.CHINESE;
  }

  if (normalized.startsWith('ko')) {
    return Language.KOREAN;
  }

  if (normalized.startsWith('en')) {
    return Language.ENGLISH;
  }

  return undefined;
};

const getSystemLocaleCandidates = (): string[] => {
  const candidates: string[] = [];

  try {
    const { locale } = Intl.DateTimeFormat().resolvedOptions();

    if (locale) {
      candidates.push(locale);
    }
  } catch {
    // Ignore environments without Intl support.
  }

  if (navigator.languages?.length) {
    candidates.push(...navigator.languages);
  }

  if (navigator.language) {
    candidates.push(navigator.language);
  }

  return candidates.filter((locale, index, all) => Boolean(locale) && all.indexOf(locale) === index);
};

export const getServerFallbackLanguage = (): ResolvedLanguage => {
  const serverLanguage = serverConfig.kialiFeatureFlags.uiDefaults?.i18n?.language;

  if (isSupportedLanguage(serverLanguage)) {
    return serverLanguage;
  }

  return Language.ENGLISH;
};

export const getSystemLanguage = (): ResolvedLanguage => {
  for (const locale of getSystemLocaleCandidates()) {
    const match = matchBrowserLanguage(locale);

    if (match) {
      return match;
    }
  }

  return getServerFallbackLanguage();
};

/** When the server does not set a language, new users follow the OS/browser locale. */
export const getDefaultLanguagePreference = (): Language => {
  const serverLanguage = serverConfig.kialiFeatureFlags.uiDefaults?.i18n?.language;

  if (isSupportedLanguage(serverLanguage)) {
    return serverLanguage;
  }

  return Language.SYSTEM;
};

export const resolveLanguage = (preference: string | null | undefined): ResolvedLanguage => {
  if (isSupportedLanguage(preference)) {
    return preference;
  }

  if (preference === Language.SYSTEM || !preference) {
    return getSystemLanguage();
  }

  return getServerFallbackLanguage();
};

export const getKialiLanguagePreference = (): Language => {
  const stored = store.getState().globalState.language;

  if (isLanguagePreference(stored)) {
    return stored;
  }

  return getDefaultLanguagePreference();
};

export const applyLanguagePreference = (preference: Language): Promise<void> => {
  const resolved = resolveLanguage(preference);
  const previousPreference = getKialiLanguagePreference();

  // Set language to default English value to force React re-render on language change.
  store.dispatch(GlobalActions.setLanguage(Language.ENGLISH));

  return i18n
    .changeLanguage(resolved)
    .then(() => {
      store.dispatch(GlobalActions.setLanguage(preference));
    })
    .catch(() => {
      store.dispatch(GlobalActions.setLanguage(previousPreference));
    });
};

export const initializeLanguage = (): Promise<void> => {
  const preference = getKialiLanguagePreference();
  const resolved = resolveLanguage(preference);

  // Set language to default English value to force React re-render on language change.
  store.dispatch(GlobalActions.setLanguage(Language.ENGLISH));

  return i18n
    .changeLanguage(resolved)
    .then(() => {
      store.dispatch(GlobalActions.setLanguage(preference));
    })
    .catch(() => {
      store.dispatch(GlobalActions.setLanguage(preference));
    });
};

export const registerSystemLanguageListener = (): (() => void) => {
  const handler = (): void => {
    if (getKialiLanguagePreference() === Language.SYSTEM) {
      applyLanguagePreference(Language.SYSTEM);
    }
  };

  window.addEventListener('languagechange', handler);

  return () => {
    window.removeEventListener('languagechange', handler);
  };
};

import { serverConfig, setServerConfig } from 'config/ServerConfig';
import { i18n } from 'i18n';
import { store } from 'store/ConfigStore';
import { GlobalActions } from 'actions/GlobalActions';
import { Language } from 'types/Common';
import {
  applyLanguagePreference,
  getDefaultLanguagePreference,
  getKialiLanguagePreference,
  getServerFallbackLanguage,
  getSystemLanguage,
  initializeLanguage,
  registerSystemLanguageListener,
  resolveLanguage
} from '../LanguageUtils';

const languageServerConfig = Object.assign({}, serverConfig);

const setI18nDefaults = (language: string): void => {
  setServerConfig({
    ...languageServerConfig,
    kialiFeatureFlags: {
      ...languageServerConfig.kialiFeatureFlags,
      uiDefaults: {
        ...languageServerConfig.kialiFeatureFlags.uiDefaults,
        i18n: {
          ...languageServerConfig.kialiFeatureFlags.uiDefaults.i18n,
          language
        }
      }
    }
  });
};

const mockIntlLocale = (locale: string): ReturnType<typeof rstest.spyOn> => {
  return rstest.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    () =>
      ({
        resolvedOptions: () => ({ locale })
      }) as Intl.DateTimeFormat
  );
};

type NavigatorLocaleSnapshot = {
  language: string;
  languages: string[];
};

const snapshotNavigatorLocales = (): NavigatorLocaleSnapshot => ({
  language: window.navigator.language,
  languages: [...(window.navigator.languages ?? [])]
});

const setNavigatorLocales = (languages: string[], language: string): void => {
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: languages
  });
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: language
  });
};

const restoreNavigatorLocales = (snapshot: NavigatorLocaleSnapshot): void => {
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: snapshot.languages
  });
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: snapshot.language
  });
};

describe('LanguageUtils', () => {
  let changeLanguageSpy: ReturnType<typeof rstest.spyOn>;
  let intlSpy: ReturnType<typeof mockIntlLocale> | undefined;
  let navigatorSnapshot: NavigatorLocaleSnapshot;

  beforeEach(() => {
    navigatorSnapshot = snapshotNavigatorLocales();
    changeLanguageSpy = rstest.spyOn(i18n, 'changeLanguage').mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    intlSpy?.mockRestore();
    intlSpy = undefined;
    changeLanguageSpy.mockRestore();
    restoreNavigatorLocales(navigatorSnapshot);
    setServerConfig(languageServerConfig);
    store.dispatch(GlobalActions.setLanguage(''));
  });

  describe('getDefaultLanguagePreference', () => {
    it('returns system when server language is not set', () => {
      setI18nDefaults('');

      expect(getDefaultLanguagePreference()).toBe(Language.SYSTEM);
    });

    it('returns server language when configured', () => {
      setI18nDefaults(Language.SPANISH);

      expect(getDefaultLanguagePreference()).toBe(Language.SPANISH);
    });
  });

  describe('getKialiLanguagePreference', () => {
    it('returns the stored language preference', () => {
      store.dispatch(GlobalActions.setLanguage(Language.SPANISH));

      expect(getKialiLanguagePreference()).toBe(Language.SPANISH);
    });

    it('falls back to the default preference when stored language is invalid', () => {
      setI18nDefaults('');
      store.dispatch(GlobalActions.setLanguage('fr'));

      expect(getKialiLanguagePreference()).toBe(Language.SYSTEM);
    });
  });

  describe('resolveLanguage', () => {
    it('returns explicit language preference', () => {
      expect(resolveLanguage(Language.KOREAN)).toBe(Language.KOREAN);
    });

    it('resolves system preference from browser languages', () => {
      intlSpy = mockIntlLocale('fr-FR');
      setNavigatorLocales(['es-ES', 'en-US'], 'es-ES');

      expect(resolveLanguage(Language.SYSTEM)).toBe(Language.SPANISH);
    });

    it('prefers the OS locale over browser language preferences', () => {
      intlSpy = mockIntlLocale('es-ES');
      setNavigatorLocales(['en-US'], 'en-US');

      expect(resolveLanguage(Language.SYSTEM)).toBe(Language.SPANISH);
    });

    it('falls back to server language for unsupported browser locales', () => {
      setI18nDefaults(Language.CHINESE);
      intlSpy = mockIntlLocale('fr-FR');
      setNavigatorLocales(['fr-FR'], 'fr-FR');

      expect(getSystemLanguage()).toBe(Language.CHINESE);
      expect(resolveLanguage(Language.SYSTEM)).toBe(Language.CHINESE);
    });

    it('falls back to the server language for invalid preferences', () => {
      setI18nDefaults(Language.KOREAN);

      expect(resolveLanguage('fr')).toBe(Language.KOREAN);
    });
  });

  describe('getServerFallbackLanguage', () => {
    it('falls back to english when server language is not set', () => {
      setI18nDefaults('');

      expect(getServerFallbackLanguage()).toBe(Language.ENGLISH);
    });

    it('returns the configured server language', () => {
      setI18nDefaults(Language.KOREAN);

      expect(getServerFallbackLanguage()).toBe(Language.KOREAN);
    });
  });

  describe('applyLanguagePreference', () => {
    it('dispatches interim english and applies the resolved locale', async () => {
      const dispatchSpy = rstest.spyOn(store, 'dispatch');

      await applyLanguagePreference(Language.SPANISH);

      expect(changeLanguageSpy).toHaveBeenCalledWith(Language.SPANISH);
      expect(dispatchSpy).toHaveBeenCalledWith(GlobalActions.setLanguage(Language.ENGLISH));
      expect(store.getState().globalState.language).toBe(Language.SPANISH);

      dispatchSpy.mockRestore();
    });

    it('restores the previous preference when locale loading fails', async () => {
      store.dispatch(GlobalActions.setLanguage(Language.KOREAN));
      changeLanguageSpy.mockRejectedValueOnce(new Error('failed to load locale'));

      await applyLanguagePreference(Language.SPANISH);

      expect(store.getState().globalState.language).toBe(Language.KOREAN);
    });
  });

  describe('initializeLanguage', () => {
    it('applies the stored system preference using the resolved locale', async () => {
      store.dispatch(GlobalActions.setLanguage(Language.SYSTEM));
      intlSpy = mockIntlLocale('es-ES');
      setNavigatorLocales(['en-US'], 'en-US');

      await initializeLanguage();

      expect(changeLanguageSpy).toHaveBeenCalledWith(Language.SPANISH);
      expect(store.getState().globalState.language).toBe(Language.SYSTEM);
    });

    it('keeps the stored preference when locale loading fails', async () => {
      store.dispatch(GlobalActions.setLanguage(Language.CHINESE));
      changeLanguageSpy.mockRejectedValueOnce(new Error('failed to load locale'));

      await initializeLanguage();

      expect(store.getState().globalState.language).toBe(Language.CHINESE);
    });
  });

  describe('registerSystemLanguageListener', () => {
    it('reapplies system language when the browser locale changes', async () => {
      store.dispatch(GlobalActions.setLanguage(Language.SYSTEM));
      const unregister = registerSystemLanguageListener();

      window.dispatchEvent(new Event('languagechange'));
      await Promise.resolve();

      expect(changeLanguageSpy).toHaveBeenCalledWith(resolveLanguage(Language.SYSTEM));

      changeLanguageSpy.mockClear();
      unregister();
      window.dispatchEvent(new Event('languagechange'));
      await Promise.resolve();

      expect(changeLanguageSpy).not.toHaveBeenCalled();
    });

    it('ignores browser locale changes when an explicit language is selected', async () => {
      store.dispatch(GlobalActions.setLanguage(Language.ENGLISH));
      const unregister = registerSystemLanguageListener();

      window.dispatchEvent(new Event('languagechange'));
      await Promise.resolve();

      expect(changeLanguageSpy).not.toHaveBeenCalled();
      unregister();
    });
  });
});

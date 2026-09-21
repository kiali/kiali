import { serverConfig, setServerConfig } from 'config/ServerConfig';
import { store } from 'store/ConfigStore';
import { GlobalActions } from 'actions/GlobalActions';
import { Language } from 'types/Common';
import {
  getDefaultLanguagePreference,
  getServerFallbackLanguage,
  getSystemLanguage,
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

describe('LanguageUtils', () => {
  let intlSpy: ReturnType<typeof mockIntlLocale> | undefined;

  afterEach(() => {
    intlSpy?.mockRestore();
    intlSpy = undefined;
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
  });

  describe('getServerFallbackLanguage', () => {
    it('falls back to english when server language is not set', () => {
      setI18nDefaults('');

      expect(getServerFallbackLanguage()).toBe(Language.ENGLISH);
    });
  });
});

import i18n from 'i18next';
import HttpBackend, { HttpBackendOptions } from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

i18n
  .use(HttpBackend) // loads translations from server
  .use(initReactI18next) // passes i18n down to react-i18next
  .init<HttpBackendOptions>({
    backend: {
      loadPath: `${process.env.PUBLIC_URL}/locales/{{lng}}/{{ns}}.json`
    },

    fallbackLng: 'en',

    interpolation: {
      escapeValue: false // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
    }
  });

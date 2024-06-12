import i18next from 'i18next';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

i18next
  .use(HttpBackend) // loads translations from server
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    backend: {
      loadPath: `${process.env.PUBLIC_URL}/locales/{{lng}}/{{ns}}.json`
    },

    fallbackLng: 'en',

    // as we use only one namespace, set with unused character to allow translated strings ends with : (default nsSeparator value)
    nsSeparator: '|',

    interpolation: {
      escapeValue: false // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
    }
  });

export const i18n = i18next;

import i18n from 'i18next';
import Backend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';
import translation_zh from './zh.json';

i18n
  .use(Backend) // loads translations from server
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources: {
      zh: {
        translation: translation_zh
      }
    },
    lng: localStorage.getItem('locale') ?? 'en',
    fallbackLng: 'en',

    interpolation: {
      escapeValue: false // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
    }
  });

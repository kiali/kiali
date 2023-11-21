import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import translation_zh from './zh.json';
// import translation_en from './en.json';

// 初始化 i18next
i18n.use(initReactI18next).init({
  resources: {
    // en: {
    //   translation: translation_en
    // },
    zh: {
      translation: translation_zh
    }
  },
  lng: localStorage.getItem('locale') || 'en',
  interpolation: {
    escapeValue: false
  }
});

// 将全局翻译方法绑定到window对象上
(window as any).$t = function (key: string, defaultValue: string = key) {
  return i18n.t(key, { defaultValue });
};

export default i18n;

import { jest } from '@jest/globals';
import { configure } from 'enzyme';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';
import jsdom from 'jsdom';

import 'jest-canvas-mock';

configure({ adapter: new Adapter() });

const JSDOM = jsdom.JSDOM;

if (!global.window) {
  global.window = new JSDOM().window;
}

window.SVGPathElement = () => {};
window.customElements = () => {};
window.customElements.define = () => {};

const tFunction = (key: string, parameters: { [key: string]: string }): string => {
  const params = JSON.stringify(parameters) ?? '{}';

  return params !== '{}' ? `${key} ${params}` : key;
};

const i18n = {
  t: tFunction,
  language: 'en',
  changeLanguage: () => Promise.resolve({}),
  isInitialized: true
};

// mock i18n and react-i18n translation functions
jest.mock('i18n', () => ({
  i18n: i18n
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tFunction,
    i18n: i18n
  })
}));

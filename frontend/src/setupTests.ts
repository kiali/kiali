import { jest } from '@jest/globals';
import { configure } from 'enzyme';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';
import jsdom from 'jsdom';
import { Location } from 'history';

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

// mock useLocation function from react-router-dom
const mockModule = jest.requireActual('react-router-dom');

const mockUseLocation = (): Location => ({
  pathname: '/another-route',
  search: '',
  hash: '',
  state: null
});

jest.mock('react-router-dom', () => {
  return {
    // @ts-ignore
    ...mockModule,
    useLocation: mockUseLocation
  };
});

import * as Enzyme from 'enzyme';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';
import { jest } from '@jest/globals';
import jsdom from 'jsdom';
import { Location } from 'history';

import 'jest-canvas-mock';

const JSDOM = jsdom.JSDOM;

if (!global.window) {
  global.window = new JSDOM().window;
}

window.SVGPathElement = () => {};
window.customElements = () => {};
window.customElements.define = () => {};

Enzyme.configure({ adapter: new Adapter() });

// mock i18n and react-i18n translation functions
jest.mock('i18n', () => ({
  i18n: {
    t: (key: string) => key,
    changeLanguage: () => new Promise(() => {})
  }
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  }),
  withTranslation: () => (component: any) => {
    component.defaultProps = { ...component.defaultProps, t: (key: string) => key };
    return component;
  },
  getI18n: () => {
    return {
      t: (key: string) => key
    };
  }
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

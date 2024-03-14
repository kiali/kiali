import * as Enzyme from 'enzyme';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';
import { jest } from '@jest/globals';
import jsdom from 'jsdom';

import 'jest-canvas-mock';

const JSDOM = jsdom.JSDOM;

if (!global.window) {
  global.window = new JSDOM().window;
}

window.SVGPathElement = () => {};
window.customElements = () => {};
window.customElements.define = () => {};

Enzyme.configure({ adapter: new Adapter() });

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
  }
}));

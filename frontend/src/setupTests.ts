import { jest } from '@jest/globals';
import '@testing-library/jest-dom/jest-globals';
import { configure } from '@testing-library/react';
import jsdom from 'jsdom';

import 'jest-canvas-mock';

configure({ testIdAttribute: 'data-test' });

const JSDOM = jsdom.JSDOM;

if (!global.window) {
  global.window = new JSDOM().window;
}

window.SVGPathElement = () => {};
window.customElements = () => {};
window.customElements.define = () => {};

// jsdom does not implement ResizeObserver. This stub prevents crashes but
// never fires callbacks, so any test relying on measured heights (e.g.
// ResizeHeightObserver consumers) must provide its own mock that triggers
// the callback with synthetic entries.
global.ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};

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

// Tests must not hit the real i18n backend; stub with a pass-through that returns the key.
jest.mock('i18n', () => ({
  i18n: i18n
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tFunction,
    i18n: i18n
  })
}));

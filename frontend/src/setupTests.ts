import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

configure({ testIdAttribute: 'data-test' });

// Stub canvas getContext so components that render <canvas> don't crash in jsdom.
HTMLCanvasElement.prototype.getContext = ((type: string) => {
  if (type === '2d') {
    return {
      canvas: { width: 0, height: 0 },
      clearRect: () => {},
      fillRect: () => {},
      fillText: () => {},
      font: '',
      measureText: (text: string) => ({ width: text.length * 8 }),
      strokeRect: () => {}
    };
  }
  return null;
}) as any;

window.SVGPathElement = (() => {}) as any;
if (!window.customElements) {
  (window as any).customElements = { define: () => {} };
}

// jsdom does not implement ResizeObserver. This stub prevents crashes but
// never fires callbacks, so any test relying on measured heights (e.g.
// ResizeHeightObserver consumers) must provide its own mock that triggers
// the callback with synthetic entries.
global.ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};

const tFunction = (key: string, parameters?: { [key: string]: string }): string => {
  if (!parameters || Object.keys(parameters).length === 0) {
    return key;
  }
  const nonEmpty = Object.fromEntries(Object.entries(parameters).filter(([, v]) => v !== '' && v != null));
  if (Object.keys(nonEmpty).length === 0) {
    return key;
  }
  return `${key} ${JSON.stringify(nonEmpty)}`;
};

const i18n = {
  t: tFunction,
  language: 'en',
  changeLanguage: () => Promise.resolve({}),
  isInitialized: true
};

// Tests must not hit the real i18n backend; stub with a pass-through that returns the key.
rstest.mock('i18n', () => ({
  i18n: i18n
}));

rstest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tFunction,
    i18n: i18n
  })
}));

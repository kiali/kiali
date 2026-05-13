/* eslint-disable import/first */
let mockKioskValue = '';

jest.mock('store/ConfigStore', () => ({
  store: {
    getState: () => ({
      globalState: {
        kiosk: mockKioskValue
      }
    }),
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    replaceReducer: jest.fn()
  }
}));

import { getKioskMode, isKioskMode, getParamsSeparator } from '../SearchParamUtils';

describe('getKioskMode', () => {
  const originalLocation = window.location;

  afterEach(() => {
    mockKioskValue = '';
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
  });

  it('returns the URL kiosk parameter when present', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '?kiosk=https://console.example.com' },
      configurable: true
    });
    mockKioskValue = 'https://other.example.com';

    expect(getKioskMode()).toBe('https://console.example.com');
  });

  it('falls back to Redux store when URL parameter is absent', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '' },
      configurable: true
    });
    mockKioskValue = 'https://console.example.com';

    expect(getKioskMode()).toBe('https://console.example.com');
  });

  it('returns empty string when neither URL nor Redux has a value', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '' },
      configurable: true
    });
    mockKioskValue = '';

    expect(getKioskMode()).toBe('');
  });
});

describe('isKioskMode', () => {
  const originalLocation = window.location;

  afterEach(() => {
    mockKioskValue = '';
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
  });

  it('returns true when kiosk mode is active via Redux', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '' },
      configurable: true
    });
    mockKioskValue = 'https://console.example.com';

    expect(isKioskMode()).toBe(true);
  });

  it('returns false when kiosk mode is not active', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '' },
      configurable: true
    });
    mockKioskValue = '';

    expect(isKioskMode()).toBe(false);
  });

  it('returns true when kiosk URL parameter is present', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '?kiosk=true' },
      configurable: true
    });
    mockKioskValue = '';

    expect(isKioskMode()).toBe(true);
  });
});

describe('getParamsSeparator', () => {
  it('returns ? for URLs without query params', () => {
    expect(getParamsSeparator('/path/to/resource')).toBe('?');
  });

  it('returns & for URLs that already have query params', () => {
    expect(getParamsSeparator('/path?existing=value')).toBe('&');
  });
});

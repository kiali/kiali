import { PARENT_KIOSK_SESSION_KEY } from 'utils/AppearanceUtils';
import { getKioskMode, isKioskMode, getParamsSeparator } from '../SearchParamUtils';

describe('getKioskMode', () => {
  const originalLocation = window.location;

  afterEach(() => {
    sessionStorage.clear();
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
  });

  it('returns the URL kiosk parameter when present', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '?kiosk=https://console.example.com' },
      configurable: true
    });
    sessionStorage.setItem(PARENT_KIOSK_SESSION_KEY, 'https://other.example.com');

    expect(getKioskMode()).toBe('https://console.example.com');
  });

  it('falls back to sessionStorage when URL parameter is absent', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '' },
      configurable: true
    });
    sessionStorage.setItem(PARENT_KIOSK_SESSION_KEY, 'https://console.example.com');

    expect(getKioskMode()).toBe('https://console.example.com');
  });

  it('falls back to sessionStorage when URL has empty kiosk value', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '?kiosk=' },
      configurable: true
    });
    sessionStorage.setItem(PARENT_KIOSK_SESSION_KEY, 'https://console.example.com');

    expect(getKioskMode()).toBe('https://console.example.com');
  });

  it('returns empty string when URL has empty kiosk and sessionStorage is also empty', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '?kiosk=' },
      configurable: true
    });

    expect(getKioskMode()).toBe('');
  });

  it('returns empty string when neither URL nor sessionStorage has a value', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '' },
      configurable: true
    });

    expect(getKioskMode()).toBe('');
  });

  it('ignores standalone kiosk flag in sessionStorage', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '' },
      configurable: true
    });
    sessionStorage.setItem(PARENT_KIOSK_SESSION_KEY, 'true');

    expect(getKioskMode()).toBe('');
  });
});

describe('isKioskMode', () => {
  const originalLocation = window.location;

  afterEach(() => {
    sessionStorage.clear();
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
  });

  it('returns true when kiosk mode is active via sessionStorage', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '' },
      configurable: true
    });
    sessionStorage.setItem(PARENT_KIOSK_SESSION_KEY, 'https://console.example.com');

    expect(isKioskMode()).toBe(true);
  });

  it('returns false when kiosk mode is not active', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '' },
      configurable: true
    });

    expect(isKioskMode()).toBe(false);
  });

  it('returns true when kiosk URL parameter is present', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '?kiosk=true' },
      configurable: true
    });

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

import {
  ColorScheme,
  ContrastMode,
  KIALI_COLOR_SCHEME,
  KIALI_CONTRAST_MODE,
  KIALI_THEME,
  PF_THEME_DARK,
  PF_THEME_FELT,
  PF_THEME_GLASS,
  PF_THEME_HIGH_CONTRAST,
  Theme
} from 'types/Common';
import {
  applyDocumentContrastMode,
  applyDocumentTheme,
  clearStaleParentKioskSession,
  getKialiContrastMode,
  getKialiColorScheme,
  getKialiTheme,
  isParentOwnedTheme,
  observeDocumentTheme,
  PARENT_KIOSK_SESSION_KEY,
  readDocumentColorScheme,
  readDocumentContrastMode,
  readDocumentTheme,
  syncReduxThemeFromDocument
} from 'utils/ThemeUtils';
import { store } from 'store/ConfigStore';
import { GlobalActions } from 'actions/GlobalActions';

describe('applyDocumentTheme', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it('toggles dark class for color scheme', () => {
    applyDocumentTheme(ColorScheme.DARK, ContrastMode.DEFAULT, Theme.DEFAULT);
    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(true);

    applyDocumentTheme(ColorScheme.LIGHT, ContrastMode.DEFAULT, Theme.DEFAULT);
    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(false);
  });

  it('applies glass contrast mode when provided', () => {
    applyDocumentTheme(ColorScheme.LIGHT, ContrastMode.GLASS, Theme.DEFAULT);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(false);
  });

  it('applies felt with glass contrast mode', () => {
    applyDocumentTheme(ColorScheme.LIGHT, ContrastMode.GLASS, Theme.FELT);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(false);
  });

  it('applies high contrast mode when provided', () => {
    applyDocumentTheme(ColorScheme.LIGHT, ContrastMode.HIGH_CONTRAST, Theme.DEFAULT);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
  });

  it('removes contrast classes for default mode', () => {
    document.documentElement.classList.add(PF_THEME_GLASS, PF_THEME_HIGH_CONTRAST, PF_THEME_FELT);
    applyDocumentTheme(ColorScheme.LIGHT, ContrastMode.DEFAULT, Theme.DEFAULT);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(false);
  });
});

describe('applyDocumentContrastMode', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it('never applies glass and high contrast together', () => {
    applyDocumentContrastMode(ContrastMode.GLASS, Theme.DEFAULT);
    applyDocumentContrastMode(ContrastMode.HIGH_CONTRAST, Theme.DEFAULT);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(true);
  });

  it('keeps felt enabled with glass', () => {
    applyDocumentContrastMode(ContrastMode.GLASS, Theme.FELT);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(true);
  });

  it('keeps felt enabled with high contrast', () => {
    applyDocumentContrastMode(ContrastMode.HIGH_CONTRAST, Theme.FELT);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
  });
});

describe('getKialiColorScheme', () => {
  afterEach(() => {
    localStorage.clear();
    store.dispatch(GlobalActions.setColorScheme(''));
  });

  it('defaults to dark when prefers-color-scheme is dark', () => {
    window.matchMedia = rstest.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;
    expect(getKialiColorScheme()).toBe(ColorScheme.DARK);
  });

  it('defaults to light when prefers-color-scheme is light', () => {
    window.matchMedia = rstest.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;
    expect(getKialiColorScheme()).toBe(ColorScheme.LIGHT);
  });

  it('ignores legacy System value and falls back to OS preference', () => {
    localStorage.setItem('KIALI_THEME', 'System');
    window.matchMedia = rstest.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;
    expect(getKialiColorScheme()).toBe(ColorScheme.DARK);
  });

  it('returns stored color scheme from localStorage', () => {
    localStorage.setItem(KIALI_COLOR_SCHEME, ColorScheme.DARK);
    expect(getKialiColorScheme()).toBe(ColorScheme.DARK);
  });

  it('falls back to legacy KIALI_THEME localStorage key', () => {
    localStorage.setItem(KIALI_THEME, ColorScheme.DARK);
    expect(getKialiColorScheme()).toBe(ColorScheme.DARK);
    expect(localStorage.getItem(KIALI_COLOR_SCHEME)).toBe(ColorScheme.DARK);
    expect(localStorage.getItem(KIALI_THEME)).toBeNull();
  });

  it('falls back to redux when localStorage is absent', () => {
    store.dispatch(GlobalActions.setColorScheme(ColorScheme.DARK));
    expect(getKialiColorScheme()).toBe(ColorScheme.DARK);
  });
});

describe('getKialiContrastMode', () => {
  afterEach(() => {
    localStorage.clear();
    store.dispatch(GlobalActions.setContrastMode(''));
  });

  it('defaults to default contrast mode', () => {
    expect(getKialiContrastMode()).toBe(ContrastMode.DEFAULT);
  });

  it('ignores invalid stored values and falls back to default', () => {
    localStorage.setItem(KIALI_CONTRAST_MODE, 'bogus');
    expect(getKialiContrastMode()).toBe(ContrastMode.DEFAULT);
  });

  it('returns stored contrast mode from localStorage', () => {
    localStorage.setItem(KIALI_CONTRAST_MODE, ContrastMode.GLASS);
    expect(getKialiContrastMode()).toBe(ContrastMode.GLASS);
  });

  it('migrates legacy contrast mode labels in localStorage', () => {
    localStorage.setItem(KIALI_CONTRAST_MODE, 'Glass');
    expect(getKialiContrastMode()).toBe(ContrastMode.GLASS);
    expect(localStorage.getItem(KIALI_CONTRAST_MODE)).toBe(ContrastMode.GLASS);
  });

  it('falls back to redux when localStorage is absent', () => {
    store.dispatch(GlobalActions.setContrastMode(ContrastMode.GLASS));
    expect(getKialiContrastMode()).toBe(ContrastMode.GLASS);
  });
});

describe('getKialiTheme', () => {
  afterEach(() => {
    localStorage.clear();
    store.dispatch(GlobalActions.setTheme(''));
  });

  it('returns felt when localStorage is felt', () => {
    localStorage.setItem(KIALI_THEME, Theme.FELT);
    expect(getKialiTheme()).toBe(Theme.FELT);
  });

  it('returns default when localStorage is default', () => {
    localStorage.setItem(KIALI_THEME, Theme.DEFAULT);
    expect(getKialiTheme()).toBe(Theme.DEFAULT);
  });

  it('falls back to redux when localStorage is absent', () => {
    store.dispatch(GlobalActions.setTheme(Theme.FELT));
    expect(getKialiTheme()).toBe(Theme.FELT);
  });
});

describe('readDocumentColorScheme', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it('reads light by default', () => {
    expect(readDocumentColorScheme()).toBe(ColorScheme.LIGHT);
  });

  it('reads dark from document classes', () => {
    document.documentElement.classList.add(PF_THEME_DARK);
    expect(readDocumentColorScheme()).toBe(ColorScheme.DARK);
  });
});

describe('readDocumentContrastMode', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it('reads default when no contrast classes are present', () => {
    expect(readDocumentContrastMode()).toBe(ContrastMode.DEFAULT);
  });

  it('prefers high contrast over glass when both are present', () => {
    document.documentElement.classList.add(PF_THEME_GLASS, PF_THEME_HIGH_CONTRAST);
    expect(readDocumentContrastMode()).toBe(ContrastMode.HIGH_CONTRAST);
  });

  it('reads glass from document classes', () => {
    document.documentElement.classList.add(PF_THEME_GLASS);
    expect(readDocumentContrastMode()).toBe(ContrastMode.GLASS);
  });
});

describe('readDocumentTheme', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it('reads felt from document classes', () => {
    document.documentElement.classList.add(PF_THEME_FELT);
    expect(readDocumentTheme()).toBe(Theme.FELT);
  });

  it('returns default when felt class is absent', () => {
    expect(readDocumentTheme()).toBe(Theme.DEFAULT);
  });
});

describe('syncReduxThemeFromDocument', () => {
  afterEach(() => {
    document.documentElement.className = '';
    localStorage.clear();
    store.dispatch(GlobalActions.setColorScheme(ColorScheme.LIGHT));
    store.dispatch(GlobalActions.setContrastMode(ContrastMode.DEFAULT));
    store.dispatch(GlobalActions.setTheme(Theme.DEFAULT));
  });

  it('dispatches color scheme, contrast, and theme without mutating document classes', () => {
    document.documentElement.classList.add(PF_THEME_DARK, PF_THEME_GLASS, PF_THEME_FELT);
    const classesBefore = document.documentElement.className;

    const result = syncReduxThemeFromDocument();

    expect(result.colorScheme).toBe(ColorScheme.DARK);
    expect(result.contrastMode).toBe(ContrastMode.GLASS);
    expect(result.theme).toBe(Theme.FELT);
    expect(store.getState().globalState.colorScheme).toBe(ColorScheme.DARK);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.GLASS);
    expect(store.getState().globalState.theme).toBe(Theme.FELT);
    expect(document.documentElement.className).toBe(classesBefore);
  });

  it('persists synced preferences to localStorage', () => {
    document.documentElement.classList.add(PF_THEME_DARK, PF_THEME_GLASS, PF_THEME_FELT);

    syncReduxThemeFromDocument();

    expect(localStorage.getItem(KIALI_COLOR_SCHEME)).toBe(ColorScheme.DARK);
    expect(localStorage.getItem(KIALI_THEME)).toBe(Theme.FELT);
    expect(localStorage.getItem(KIALI_CONTRAST_MODE)).toBe(ContrastMode.GLASS);
  });
});

describe('observeDocumentTheme', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it('notifies when theme class changes', async () => {
    const onChange = rstest.fn();
    const unsubscribe = observeDocumentTheme(onChange);

    document.documentElement.classList.add(PF_THEME_DARK);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onChange).toHaveBeenCalled();
    unsubscribe();
  });

  it('notifies when contrast class changes', async () => {
    const onChange = rstest.fn();
    const unsubscribe = observeDocumentTheme(onChange);

    document.documentElement.classList.add(PF_THEME_GLASS);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onChange).toHaveBeenCalled();
    unsubscribe();
  });

  it('notifies when felt class changes', async () => {
    const onChange = rstest.fn();
    const unsubscribe = observeDocumentTheme(onChange);

    document.documentElement.classList.add(PF_THEME_FELT);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onChange).toHaveBeenCalled();
    unsubscribe();
  });

  it('does not notify after unsubscribe', async () => {
    const onChange = rstest.fn();
    const unsubscribe = observeDocumentTheme(onChange);
    unsubscribe();

    document.documentElement.classList.add(PF_THEME_DARK);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('isParentOwnedTheme', () => {
  const originalTop = window.top;

  afterEach(() => {
    sessionStorage.clear();
    store.dispatch(GlobalActions.setKiosk(''));
    Object.defineProperty(window, 'top', { configurable: true, value: originalTop });
    window.history.replaceState({}, '', '/');
  });

  it('is false in standalone mode', () => {
    store.dispatch(GlobalActions.setKiosk('/'));
    expect(isParentOwnedTheme()).toBe(false);
  });

  it('is true for same-window parent kiosk URL (OSSMC)', () => {
    window.history.replaceState({}, '', '/?kiosk=/');
    expect(isParentOwnedTheme()).toBe(true);
  });

  it('is true after OSSMC SPA navigation when session kiosk is set', () => {
    window.history.replaceState({}, '', '/?kiosk=/');
    isParentOwnedTheme();
    window.history.replaceState({}, '', '/');
    expect(isParentOwnedTheme()).toBe(true);
  });

  it('is false after standalone full page load clears stale session', () => {
    sessionStorage.setItem(PARENT_KIOSK_SESSION_KEY, '/');
    window.history.replaceState({}, '', '/');
    clearStaleParentKioskSession();
    expect(isParentOwnedTheme()).toBe(false);
  });

  it('is false for standalone kiosk flag', () => {
    window.history.replaceState({}, '', '/?kiosk=true');
    expect(isParentOwnedTheme()).toBe(false);
  });

  it('is false when embedded in an iframe', () => {
    window.history.replaceState({}, '', '/?kiosk=/');
    Object.defineProperty(window, 'top', { configurable: true, value: {} });
    expect(isParentOwnedTheme()).toBe(false);
  });
});

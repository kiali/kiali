import {
  ContrastMode,
  KIALI_COLOR_SCHEME,
  KIALI_CONTRAST_MODE,
  KIALI_THEME,
  KIALI_THEME_FELT,
  PF_THEME_DARK,
  PF_THEME_FELT,
  PF_THEME_GLASS,
  PF_THEME_HIGH_CONTRAST,
  Theme,
  ThemeVariant
} from 'types/Common';
import {
  applyDocumentContrastMode,
  applyDocumentTheme,
  getKialiContrastMode,
  getKialiColorScheme,
  getKialiTheme,
  isParentOwnedTheme,
  observeDocumentTheme,
  readDocumentContrastMode,
  readDocumentTheme,
  readDocumentThemeVariant,
  syncReduxThemeFromDocument
} from 'utils/ThemeUtils';
import { store } from 'store/ConfigStore';
import { GlobalActions } from 'actions/GlobalActions';

describe('applyDocumentTheme', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it('toggles dark class for color scheme', () => {
    applyDocumentTheme(Theme.DARK);
    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(true);

    applyDocumentTheme(Theme.LIGHT);
    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(false);
  });

  it('applies glass contrast mode when provided', () => {
    applyDocumentTheme(Theme.LIGHT, ContrastMode.GLASS, ThemeVariant.DEFAULT);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(false);
  });

  it('applies felt with glass contrast mode', () => {
    applyDocumentTheme(Theme.LIGHT, ContrastMode.GLASS, ThemeVariant.FELT);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(false);
  });

  it('applies high contrast mode when provided', () => {
    applyDocumentTheme(Theme.LIGHT, ContrastMode.HIGH_CONTRAST, ThemeVariant.DEFAULT);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
  });

  it('removes contrast classes for default mode', () => {
    document.documentElement.classList.add(PF_THEME_GLASS, PF_THEME_HIGH_CONTRAST, PF_THEME_FELT);
    applyDocumentTheme(Theme.LIGHT, ContrastMode.TRADITIONAL, ThemeVariant.DEFAULT);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(false);
  });

  it('does not change contrast classes when contrast mode is omitted', () => {
    document.documentElement.classList.add(PF_THEME_GLASS);
    applyDocumentTheme(Theme.DARK);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
  });

  it('toggles felt independently when only theme variant is provided', () => {
    applyDocumentTheme(Theme.LIGHT, undefined, ThemeVariant.FELT);
    expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(true);
  });
});

describe('applyDocumentContrastMode', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it('never applies glass and high contrast together', () => {
    applyDocumentContrastMode(ContrastMode.GLASS, ThemeVariant.DEFAULT);
    applyDocumentContrastMode(ContrastMode.HIGH_CONTRAST, ThemeVariant.DEFAULT);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(true);
  });

  it('keeps felt enabled with glass', () => {
    applyDocumentContrastMode(ContrastMode.GLASS, ThemeVariant.FELT);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(true);
  });

  it('keeps felt enabled with high contrast', () => {
    applyDocumentContrastMode(ContrastMode.HIGH_CONTRAST, ThemeVariant.FELT);
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
    expect(getKialiColorScheme()).toBe(Theme.DARK);
  });

  it('defaults to light when prefers-color-scheme is light', () => {
    window.matchMedia = rstest.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;
    expect(getKialiColorScheme()).toBe(Theme.LIGHT);
  });

  it('ignores legacy System value and falls back to OS preference', () => {
    localStorage.setItem('KIALI_THEME', 'System');
    window.matchMedia = rstest.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;
    expect(getKialiColorScheme()).toBe(Theme.DARK);
  });

  it('returns stored color scheme from localStorage', () => {
    localStorage.setItem(KIALI_COLOR_SCHEME, Theme.DARK);
    expect(getKialiColorScheme()).toBe(Theme.DARK);
  });

  it('falls back to legacy KIALI_THEME localStorage key', () => {
    localStorage.setItem(KIALI_THEME, Theme.DARK);
    expect(getKialiColorScheme()).toBe(Theme.DARK);
  });
});

describe('getKialiContrastMode', () => {
  afterEach(() => {
    localStorage.clear();
    store.dispatch(GlobalActions.setContrastMode(''));
  });

  it('defaults to high contrast when prefers-contrast is more', () => {
    window.matchMedia = rstest.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;
    expect(getKialiContrastMode()).toBe(ContrastMode.HIGH_CONTRAST);
  });

  it('defaults to traditional when prefers-contrast is not more', () => {
    window.matchMedia = rstest.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;
    expect(getKialiContrastMode()).toBe(ContrastMode.TRADITIONAL);
  });

  it('ignores legacy System value and falls back to OS preference', () => {
    localStorage.setItem('KIALI_CONTRAST_MODE', 'System');
    window.matchMedia = rstest.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;
    expect(getKialiContrastMode()).toBe(ContrastMode.TRADITIONAL);
  });

  it('returns stored contrast mode from localStorage', () => {
    localStorage.setItem(KIALI_CONTRAST_MODE, ContrastMode.GLASS);
    expect(getKialiContrastMode()).toBe(ContrastMode.GLASS);
  });
});

describe('getKialiTheme', () => {
  afterEach(() => {
    localStorage.clear();
    store.dispatch(GlobalActions.setTheme(''));
  });

  it('returns felt when localStorage is felt', () => {
    localStorage.setItem(KIALI_THEME, ThemeVariant.FELT);
    expect(getKialiTheme()).toBe(ThemeVariant.FELT);
  });

  it('returns default when localStorage is default', () => {
    localStorage.setItem(KIALI_THEME, ThemeVariant.DEFAULT);
    expect(getKialiTheme()).toBe(ThemeVariant.DEFAULT);
  });

  it('migrates legacy KIALI_THEME_FELT true to felt', () => {
    localStorage.setItem(KIALI_THEME_FELT, 'true');
    expect(getKialiTheme()).toBe(ThemeVariant.FELT);
    expect(localStorage.getItem(KIALI_THEME)).toBe(ThemeVariant.FELT);
    expect(localStorage.getItem(KIALI_THEME_FELT)).toBeNull();
  });

  it('falls back to redux when localStorage is absent', () => {
    store.dispatch(GlobalActions.setTheme(ThemeVariant.FELT));
    expect(getKialiTheme()).toBe(ThemeVariant.FELT);
  });
});

describe('readDocumentTheme', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it('reads light by default', () => {
    expect(readDocumentTheme()).toBe(Theme.LIGHT);
  });

  it('reads dark from document classes', () => {
    document.documentElement.classList.add(PF_THEME_DARK);
    expect(readDocumentTheme()).toBe(Theme.DARK);
  });
});

describe('readDocumentContrastMode', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it('reads default when no contrast classes are present', () => {
    expect(readDocumentContrastMode()).toBe(ContrastMode.TRADITIONAL);
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

describe('readDocumentThemeVariant', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it('reads felt from document classes', () => {
    document.documentElement.classList.add(PF_THEME_FELT);
    expect(readDocumentThemeVariant()).toBe(ThemeVariant.FELT);
  });

  it('returns default when felt class is absent', () => {
    expect(readDocumentThemeVariant()).toBe(ThemeVariant.DEFAULT);
  });
});

describe('syncReduxThemeFromDocument', () => {
  afterEach(() => {
    document.documentElement.className = '';
    localStorage.clear();
    store.dispatch(GlobalActions.setColorScheme(Theme.LIGHT));
    store.dispatch(GlobalActions.setContrastMode(ContrastMode.TRADITIONAL));
    store.dispatch(GlobalActions.setTheme(ThemeVariant.DEFAULT));
  });

  it('dispatches color scheme, contrast, and theme without mutating document classes', () => {
    document.documentElement.classList.add(PF_THEME_DARK, PF_THEME_GLASS, PF_THEME_FELT);
    const classesBefore = document.documentElement.className;

    const result = syncReduxThemeFromDocument();

    expect(result.colorScheme).toBe(Theme.DARK);
    expect(result.contrastMode).toBe(ContrastMode.GLASS);
    expect(result.theme).toBe(ThemeVariant.FELT);
    expect(store.getState().globalState.colorScheme).toBe(Theme.DARK);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.GLASS);
    expect(store.getState().globalState.theme).toBe(ThemeVariant.FELT);
    expect(document.documentElement.className).toBe(classesBefore);
  });

  it('persists synced preferences to localStorage', () => {
    document.documentElement.classList.add(PF_THEME_DARK, PF_THEME_GLASS, PF_THEME_FELT);

    syncReduxThemeFromDocument();

    expect(localStorage.getItem(KIALI_COLOR_SCHEME)).toBe(Theme.DARK);
    expect(localStorage.getItem(KIALI_THEME)).toBe(ThemeVariant.FELT);
    expect(localStorage.getItem(KIALI_CONTRAST_MODE)).toBe(ContrastMode.GLASS);
    expect(localStorage.getItem(KIALI_THEME_FELT)).toBeNull();
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

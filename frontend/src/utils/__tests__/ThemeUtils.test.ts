import { ContrastMode, PF_THEME_DARK, PF_THEME_GLASS, PF_THEME_HIGH_CONTRAST, Theme } from 'types/Common';
import {
  applyDocumentContrastMode,
  applyDocumentTheme,
  isParentOwnedTheme,
  observeDocumentTheme,
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
    applyDocumentTheme(Theme.DARK);
    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(true);

    applyDocumentTheme(Theme.LIGHT);
    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(false);
  });

  it('applies glass contrast mode when provided', () => {
    applyDocumentTheme(Theme.LIGHT, ContrastMode.GLASS);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(false);
  });

  it('applies high contrast mode when provided', () => {
    applyDocumentTheme(Theme.LIGHT, ContrastMode.HIGH_CONTRAST);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
  });

  it('removes contrast classes for default mode', () => {
    document.documentElement.classList.add(PF_THEME_GLASS, PF_THEME_HIGH_CONTRAST);
    applyDocumentTheme(Theme.LIGHT, ContrastMode.DEFAULT);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(false);
  });

  it('does not change contrast classes when contrast mode is omitted', () => {
    document.documentElement.classList.add(PF_THEME_GLASS);
    applyDocumentTheme(Theme.DARK);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
  });
});

describe('applyDocumentContrastMode', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it('never applies glass and high contrast together', () => {
    applyDocumentContrastMode(ContrastMode.GLASS);
    applyDocumentContrastMode(ContrastMode.HIGH_CONTRAST);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(true);
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

describe('syncReduxThemeFromDocument', () => {
  afterEach(() => {
    document.documentElement.className = '';
    store.dispatch(GlobalActions.setTheme(Theme.LIGHT));
    store.dispatch(GlobalActions.setContrastMode(ContrastMode.DEFAULT));
  });

  it('dispatches theme and contrast without mutating document classes', () => {
    document.documentElement.classList.add(PF_THEME_DARK, PF_THEME_GLASS);
    const classesBefore = document.documentElement.className;

    const result = syncReduxThemeFromDocument();

    expect(result.theme).toBe(Theme.DARK);
    expect(result.contrastMode).toBe(ContrastMode.GLASS);
    expect(store.getState().globalState.theme).toBe(Theme.DARK);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.GLASS);
    expect(document.documentElement.className).toBe(classesBefore);
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
  afterEach(() => {
    store.dispatch(GlobalActions.setKiosk(''));
  });

  it('is false in standalone mode', () => {
    store.dispatch(GlobalActions.setKiosk(''));
    expect(isParentOwnedTheme()).toBe(false);
  });

  it('is true for same-window parent kiosk (OSSMC)', () => {
    store.dispatch(GlobalActions.setKiosk('/'));
    expect(isParentOwnedTheme()).toBe(true);
  });

  it('is false for standalone kiosk flag', () => {
    store.dispatch(GlobalActions.setKiosk('true'));
    expect(isParentOwnedTheme()).toBe(false);
  });
});

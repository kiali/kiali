import { ContrastMode, PF_THEME_DARK, PF_THEME_GLASS, PF_THEME_HIGH_CONTRAST, Theme } from 'types/Common';
import {
  applyDocumentTheme,
  isParentOwnedTheme,
  observeDocumentTheme,
  readDocumentContrastMode,
  readDocumentTheme,
  syncReduxThemeFromDocument
} from '../ThemeUtils';
import { store } from 'store/ConfigStore';
import { GlobalActions } from 'actions/GlobalActions';

describe('applyDocumentTheme', () => {
  beforeEach(() => {
    document.documentElement.className = '';
  });

  it('applies dark color scheme', () => {
    applyDocumentTheme(Theme.DARK, ContrastMode.DEFAULT);

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(false);
  });

  it('applies glass contrast mode', () => {
    applyDocumentTheme(Theme.LIGHT, ContrastMode.GLASS);

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(false);
  });

  it('applies high contrast and not glass', () => {
    applyDocumentTheme(Theme.DARK, ContrastMode.HIGH_CONTRAST);

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(true);
  });

  it('clears previous classes when switching modes', () => {
    applyDocumentTheme(Theme.DARK, ContrastMode.GLASS);
    applyDocumentTheme(Theme.LIGHT, ContrastMode.HIGH_CONTRAST);

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(true);
  });
});

describe('readDocumentTheme / readDocumentContrastMode', () => {
  beforeEach(() => {
    document.documentElement.className = '';
  });

  it('reads light + default when no theme classes', () => {
    expect(readDocumentTheme()).toBe(Theme.LIGHT);
    expect(readDocumentContrastMode()).toBe(ContrastMode.DEFAULT);
  });

  it('reads dark + glass from document classes', () => {
    document.documentElement.classList.add(PF_THEME_DARK, PF_THEME_GLASS);

    expect(readDocumentTheme()).toBe(Theme.DARK);
    expect(readDocumentContrastMode()).toBe(ContrastMode.GLASS);
  });

  it('prefers high contrast over glass when both present', () => {
    document.documentElement.classList.add(PF_THEME_GLASS, PF_THEME_HIGH_CONTRAST);

    expect(readDocumentContrastMode()).toBe(ContrastMode.HIGH_CONTRAST);
  });
});

describe('syncReduxThemeFromDocument', () => {
  beforeEach(() => {
    document.documentElement.className = '';
  });

  it('updates redux from document without changing classes', () => {
    document.documentElement.classList.add(PF_THEME_DARK, PF_THEME_GLASS);
    const classesBefore = document.documentElement.className;

    const result = syncReduxThemeFromDocument();

    expect(result).toEqual({ theme: Theme.DARK, contrastMode: ContrastMode.GLASS });
    expect(store.getState().globalState.theme).toBe(Theme.DARK);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.GLASS);
    expect(document.documentElement.className).toBe(classesBefore);
  });
});

describe('observeDocumentTheme', () => {
  beforeEach(() => {
    document.documentElement.className = '';
  });

  it('notifies when theme classes change', async () => {
    const onChange = rstest.fn();
    const unsubscribe = observeDocumentTheme(onChange);

    document.documentElement.classList.add(PF_THEME_DARK);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onChange).toHaveBeenCalled();
    unsubscribe();
  });

  it('does not notify after unsubscribe', async () => {
    const onChange = rstest.fn();
    const unsubscribe = observeDocumentTheme(onChange);
    unsubscribe();

    document.documentElement.classList.add(PF_THEME_GLASS);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('isParentOwnedTheme', () => {
  afterEach(() => {
    store.dispatch(GlobalActions.setKiosk(''));
    window.history.replaceState({}, '', '/');
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

import { PF_THEME_DARK, Theme } from 'types/Common';
import {
  applyDocumentTheme,
  isParentOwnedTheme,
  observeDocumentTheme,
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

  it('does not apply glass or high-contrast classes', () => {
    applyDocumentTheme(Theme.DARK);
    expect(document.documentElement.classList.contains('pf-v6-theme-glass')).toBe(false);
    expect(document.documentElement.classList.contains('pf-v6-theme-high-contrast')).toBe(false);
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

describe('syncReduxThemeFromDocument', () => {
  afterEach(() => {
    document.documentElement.className = '';
    store.dispatch(GlobalActions.setTheme(Theme.LIGHT));
  });

  it('dispatches theme without mutating document classes', () => {
    document.documentElement.classList.add(PF_THEME_DARK, 'pf-v6-theme-glass');
    const classesBefore = document.documentElement.className;

    const theme = syncReduxThemeFromDocument();

    expect(theme).toBe(Theme.DARK);
    expect(store.getState().globalState.theme).toBe(Theme.DARK);
    expect(document.documentElement.className).toBe(classesBefore);
  });
});

describe('observeDocumentTheme', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it('notifies when theme class changes', async () => {
    const onChange = jest.fn();
    const unsubscribe = observeDocumentTheme(onChange);

    document.documentElement.classList.add(PF_THEME_DARK);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onChange).toHaveBeenCalled();
    unsubscribe();
  });

  it('does not notify after unsubscribe', async () => {
    const onChange = jest.fn();
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

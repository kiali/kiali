import { render } from '@testing-library/react';
import { ParentThemeSync } from '../ParentThemeSync';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { ContrastMode, PF_THEME_DARK, PF_THEME_FELT, PF_THEME_GLASS, Theme, ThemeVariant } from 'types/Common';

describe('ParentThemeSync', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    sessionStorage.clear();
    store.dispatch(GlobalActions.setKiosk(''));
    store.dispatch(GlobalActions.setColorScheme(Theme.LIGHT));
    store.dispatch(GlobalActions.setContrastMode(ContrastMode.TRADITIONAL));
    store.dispatch(GlobalActions.setTheme(ThemeVariant.DEFAULT));
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('does nothing when not in parent-owned theme mode', () => {
    document.documentElement.classList.add(PF_THEME_DARK, PF_THEME_GLASS);

    render(<ParentThemeSync />);

    expect(store.getState().globalState.colorScheme).toBe(Theme.LIGHT);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.TRADITIONAL);
    expect(store.getState().globalState.theme).toBe(ThemeVariant.DEFAULT);
  });

  it('syncs redux from document when parent kiosk owns the window', () => {
    window.history.replaceState({}, '', '/?kiosk=/');
    document.documentElement.classList.add(PF_THEME_DARK, PF_THEME_GLASS, PF_THEME_FELT);

    render(<ParentThemeSync />);

    expect(store.getState().globalState.colorScheme).toBe(Theme.DARK);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.GLASS);
    expect(store.getState().globalState.theme).toBe(ThemeVariant.FELT);
  });

  it('syncs redux when parent theme classes change after mount', async () => {
    window.history.replaceState({}, '', '/?kiosk=/');

    render(<ParentThemeSync />);

    expect(store.getState().globalState.theme).toBe(ThemeVariant.DEFAULT);

    document.documentElement.classList.add(PF_THEME_FELT);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(store.getState().globalState.theme).toBe(ThemeVariant.FELT);
  });
});

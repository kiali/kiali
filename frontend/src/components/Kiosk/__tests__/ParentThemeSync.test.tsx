import { render } from '@testing-library/react';
import { ParentThemeSync } from '../ParentThemeSync';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { ContrastMode, PF_THEME_DARK, Theme } from 'types/Common';

describe('ParentThemeSync', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    store.dispatch(GlobalActions.setKiosk(''));
    store.dispatch(GlobalActions.setTheme(Theme.LIGHT));
    store.dispatch(GlobalActions.setContrastMode(ContrastMode.TRADITIONAL));
    store.dispatch(GlobalActions.setThemeFelt(false));
  });

  it('does nothing when not in parent-owned theme mode', () => {
    document.documentElement.classList.add(PF_THEME_DARK, 'pf-v6-theme-glass');

    render(<ParentThemeSync />);

    // Standalone: kiosk empty — should not sync from document
    expect(store.getState().globalState.theme).toBe(Theme.LIGHT);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.TRADITIONAL);
    expect(store.getState().globalState.themeFelt).toBe(false);
  });

  it('syncs redux from document when parent kiosk owns the window', () => {
    store.dispatch(GlobalActions.setKiosk('/'));
    document.documentElement.classList.add(PF_THEME_DARK, 'pf-v6-theme-glass');

    render(<ParentThemeSync />);

    expect(store.getState().globalState.theme).toBe(Theme.DARK);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.GLASS);
    expect(store.getState().globalState.themeFelt).toBe(false);
  });
});

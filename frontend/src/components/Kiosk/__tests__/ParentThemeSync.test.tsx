import { render } from '@testing-library/react';
import { ParentThemeSync } from '../ParentThemeSync';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { ContrastMode, PF_THEME_DARK, PF_THEME_GLASS, Theme } from 'types/Common';

describe('ParentThemeSync', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    store.dispatch(GlobalActions.setKiosk(''));
    store.dispatch(GlobalActions.setTheme(Theme.LIGHT));
    store.dispatch(GlobalActions.setContrastMode(ContrastMode.DEFAULT));
  });

  it('does nothing when not in parent-owned theme mode', () => {
    document.documentElement.classList.add(PF_THEME_DARK, PF_THEME_GLASS);

    render(<ParentThemeSync />);

    // Standalone: kiosk empty — should not sync from document
    expect(store.getState().globalState.theme).toBe(Theme.LIGHT);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.DEFAULT);
  });

  it('syncs redux from document when parent kiosk owns the window', () => {
    store.dispatch(GlobalActions.setKiosk('/'));
    document.documentElement.classList.add(PF_THEME_DARK, PF_THEME_GLASS);

    render(<ParentThemeSync />);

    expect(store.getState().globalState.theme).toBe(Theme.DARK);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.GLASS);
  });
});

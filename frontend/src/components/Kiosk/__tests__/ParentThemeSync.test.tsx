import { render } from '@testing-library/react';
import { ParentThemeSync } from '../ParentThemeSync';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { PF_THEME_DARK, Theme } from 'types/Common';

describe('ParentThemeSync', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    store.dispatch(GlobalActions.setKiosk(''));
    store.dispatch(GlobalActions.setTheme(Theme.LIGHT));
  });

  it('does nothing when not in parent-owned theme mode', () => {
    document.documentElement.classList.add(PF_THEME_DARK, 'pf-v6-theme-glass');

    render(<ParentThemeSync />);

    // Standalone: kiosk empty — should not sync from document
    expect(store.getState().globalState.theme).toBe(Theme.LIGHT);
  });

  it('syncs redux from document when parent kiosk owns the window', () => {
    store.dispatch(GlobalActions.setKiosk('/'));
    document.documentElement.classList.add(PF_THEME_DARK, 'pf-v6-theme-glass');

    render(<ParentThemeSync />);

    expect(store.getState().globalState.theme).toBe(Theme.DARK);
  });
});

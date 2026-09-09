import * as React from 'react';
import { mount } from 'enzyme';
import { ParentThemeSync } from '../ParentThemeSync';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { PF_THEME_DARK, Theme } from 'types/Common';
import * as SearchParamUtils from 'utils/SearchParamUtils';

describe('ParentThemeSync', () => {
  let getKioskModeSpy: jest.SpyInstance;

  beforeEach(() => {
    document.documentElement.className = '';
    store.dispatch(GlobalActions.setKiosk(''));
    store.dispatch(GlobalActions.setTheme(Theme.LIGHT));
    getKioskModeSpy = jest.spyOn(SearchParamUtils, 'getKioskMode').mockReturnValue('');
  });

  afterEach(() => {
    getKioskModeSpy.mockRestore();
  });

  it('does nothing when not in parent-owned theme mode', () => {
    document.documentElement.classList.add(PF_THEME_DARK, 'pf-v6-theme-glass');

    mount(<ParentThemeSync />);

    // Standalone: kiosk empty — should not sync from document
    expect(store.getState().globalState.theme).toBe(Theme.LIGHT);
  });

  it('syncs redux from document when parent kiosk owns the window', () => {
    store.dispatch(GlobalActions.setKiosk('/'));
    getKioskModeSpy.mockReturnValue('/');
    document.documentElement.classList.add(PF_THEME_DARK, 'pf-v6-theme-glass');

    mount(<ParentThemeSync />);

    expect(store.getState().globalState.theme).toBe(Theme.DARK);
  });
});

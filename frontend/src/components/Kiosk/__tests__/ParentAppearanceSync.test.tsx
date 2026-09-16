import { render, waitFor } from '@testing-library/react';
import { ParentAppearanceSync } from '../ParentAppearanceSync';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import {
  ColorScheme,
  ContrastMode,
  PF_THEME_DARK,
  PF_THEME_FELT,
  PF_THEME_GLASS,
  PF_THEME_HIGH_CONTRAST,
  Theme
} from 'types/Common';

describe('ParentAppearanceSync', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    sessionStorage.clear();
    store.dispatch(GlobalActions.setKiosk(''));
    store.dispatch(GlobalActions.setColorScheme(ColorScheme.LIGHT));
    store.dispatch(GlobalActions.setContrastMode(ContrastMode.DEFAULT));
    store.dispatch(GlobalActions.setTheme(Theme.DEFAULT));
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('does nothing when not in parent-owned theme mode', () => {
    document.documentElement.classList.add(PF_THEME_DARK, PF_THEME_GLASS);

    render(<ParentAppearanceSync />);

    expect(store.getState().globalState.colorScheme).toBe(ColorScheme.LIGHT);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.DEFAULT);
    expect(store.getState().globalState.theme).toBe(Theme.DEFAULT);
  });

  it('syncs redux from document when parent kiosk owns the window', () => {
    window.history.replaceState({}, '', '/?kiosk=/');
    document.documentElement.classList.add(PF_THEME_DARK, PF_THEME_GLASS, PF_THEME_FELT);

    render(<ParentAppearanceSync />);

    expect(store.getState().globalState.colorScheme).toBe(ColorScheme.DARK);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.GLASS);
    expect(store.getState().globalState.theme).toBe(Theme.FELT);
  });

  it('syncs redux when parent theme classes change after mount', async () => {
    window.history.replaceState({}, '', '/?kiosk=/');

    render(<ParentAppearanceSync />);

    expect(store.getState().globalState.theme).toBe(Theme.DEFAULT);

    document.documentElement.classList.add(PF_THEME_FELT);

    await waitFor(() => {
      expect(store.getState().globalState.theme).toBe(Theme.FELT);
    });
  });

  it('syncs color scheme when parent dark class changes after mount', async () => {
    window.history.replaceState({}, '', '/?kiosk=/');

    render(<ParentAppearanceSync />);

    document.documentElement.classList.add(PF_THEME_DARK);

    await waitFor(() => {
      expect(store.getState().globalState.colorScheme).toBe(ColorScheme.DARK);
    });
  });

  it('syncs contrast mode when parent glass class changes after mount', async () => {
    window.history.replaceState({}, '', '/?kiosk=/');

    render(<ParentAppearanceSync />);

    document.documentElement.classList.add(PF_THEME_GLASS);

    await waitFor(() => {
      expect(store.getState().globalState.contrastMode).toBe(ContrastMode.GLASS);
    });
  });

  it('syncs high contrast when parent class changes after mount', async () => {
    window.history.replaceState({}, '', '/?kiosk=/');

    render(<ParentAppearanceSync />);

    document.documentElement.classList.add(PF_THEME_HIGH_CONTRAST);

    await waitFor(() => {
      expect(store.getState().globalState.contrastMode).toBe(ContrastMode.HIGH_CONTRAST);
    });
  });
});

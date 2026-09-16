import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeSwitchComponent } from '../Masthead/ThemeSwitch';
import {
  ColorScheme,
  ContrastMode,
  KIALI_COLOR_SCHEME,
  KIALI_CONTRAST_MODE,
  KIALI_THEME,
  PF_THEME_DARK,
  PF_THEME_FELT,
  PF_THEME_GLASS,
  PF_THEME_HIGH_CONTRAST,
  Theme
} from 'types/Common';
import { store } from 'store/ConfigStore';
import { GlobalActions } from 'actions/GlobalActions';

const resetAppearanceState = (): void => {
  document.documentElement.className = '';
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  store.dispatch(GlobalActions.setColorScheme(ColorScheme.LIGHT));
  store.dispatch(GlobalActions.setContrastMode(ContrastMode.DEFAULT));
  store.dispatch(GlobalActions.setTheme(Theme.DEFAULT));
  store.dispatch(GlobalActions.setKiosk(''));
};

describe('ThemeSwitch renders', () => {
  beforeEach(() => {
    resetAppearanceState();
  });

  it('light theme', () => {
    render(
      <ThemeSwitchComponent contrastMode={ContrastMode.DEFAULT} colorScheme={ColorScheme.LIGHT} theme={Theme.DEFAULT} />
    );

    expect(screen.getByLabelText(/Theme selection, current: Light/)).toBeInTheDocument();
  });

  it('dark theme', () => {
    render(
      <ThemeSwitchComponent contrastMode={ContrastMode.DEFAULT} colorScheme={ColorScheme.DARK} theme={Theme.DEFAULT} />
    );

    expect(screen.getByLabelText(/Theme selection, current: Dark/)).toBeInTheDocument();
  });

  it('felt with glass contrast in aria label', () => {
    render(
      <ThemeSwitchComponent contrastMode={ContrastMode.GLASS} colorScheme={ColorScheme.LIGHT} theme={Theme.FELT} />
    );

    expect(screen.getByLabelText(/Theme selection, current: Light, Project Felt, Glass/)).toBeInTheDocument();
  });

  it('high contrast in aria label', () => {
    render(
      <ThemeSwitchComponent
        contrastMode={ContrastMode.HIGH_CONTRAST}
        colorScheme={ColorScheme.DARK}
        theme={Theme.DEFAULT}
      />
    );

    expect(screen.getByLabelText(/Theme selection, current: Dark, High contrast/)).toBeInTheDocument();
  });

  it('is hidden when parent owns theme', () => {
    window.history.replaceState({}, '', '/?kiosk=/');
    const { container } = render(
      <ThemeSwitchComponent contrastMode={ContrastMode.DEFAULT} colorScheme={ColorScheme.LIGHT} theme={Theme.DEFAULT} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe('ThemeSwitch changes', () => {
  beforeEach(() => {
    resetAppearanceState();
  });

  it('to dark theme', async () => {
    render(
      <ThemeSwitchComponent contrastMode={ContrastMode.DEFAULT} colorScheme={ColorScheme.LIGHT} theme={Theme.DEFAULT} />
    );

    await userEvent.click(screen.getByLabelText(/Theme selection/));
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(true);
    expect(store.getState().globalState.colorScheme).toBe(ColorScheme.DARK);
    expect(localStorage.getItem(KIALI_COLOR_SCHEME)).toBe(ColorScheme.DARK);
  });

  it('to light theme', async () => {
    render(
      <ThemeSwitchComponent contrastMode={ContrastMode.DEFAULT} colorScheme={ColorScheme.DARK} theme={Theme.DEFAULT} />
    );

    await userEvent.click(screen.getByLabelText(/Theme selection/));
    await userEvent.click(screen.getByRole('button', { name: 'Light' }));

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(false);
    expect(store.getState().globalState.colorScheme).toBe(ColorScheme.LIGHT);
    expect(localStorage.getItem(KIALI_COLOR_SCHEME)).toBe(ColorScheme.LIGHT);
  });

  it('to glass contrast mode', async () => {
    render(
      <ThemeSwitchComponent contrastMode={ContrastMode.DEFAULT} colorScheme={ColorScheme.LIGHT} theme={Theme.DEFAULT} />
    );

    await userEvent.click(screen.getByLabelText(/Theme selection/));
    await userEvent.click(screen.getByRole('button', { name: 'Glass' }));

    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.GLASS);
  });

  it('to default contrast mode', async () => {
    render(
      <ThemeSwitchComponent contrastMode={ContrastMode.GLASS} colorScheme={ColorScheme.LIGHT} theme={Theme.DEFAULT} />
    );

    await userEvent.click(screen.getByLabelText(/Theme selection/));
    const contrastToggle = screen.getByTestId('contrast-mode-toggle');
    await userEvent.click(within(contrastToggle).getByRole('button', { name: 'Default' }));

    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.DEFAULT);
    expect(localStorage.getItem(KIALI_CONTRAST_MODE)).toBe(ContrastMode.DEFAULT);
  });

  it('to felt with glass contrast mode', async () => {
    render(
      <ThemeSwitchComponent contrastMode={ContrastMode.GLASS} colorScheme={ColorScheme.LIGHT} theme={Theme.DEFAULT} />
    );

    await userEvent.click(screen.getByLabelText(/Theme selection/));
    await userEvent.click(screen.getByRole('button', { name: 'Project Felt' }));

    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(true);
    expect(store.getState().globalState.theme).toBe(Theme.FELT);
    expect(localStorage.getItem(KIALI_THEME)).toBe(Theme.FELT);
  });

  it('off felt theme', async () => {
    render(
      <ThemeSwitchComponent contrastMode={ContrastMode.GLASS} colorScheme={ColorScheme.LIGHT} theme={Theme.FELT} />
    );

    await userEvent.click(screen.getByLabelText(/Theme selection/));
    const themeToggle = screen.getByTestId('theme-toggle');
    await userEvent.click(within(themeToggle).getByRole('button', { name: 'Default' }));

    expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(false);
    expect(store.getState().globalState.theme).toBe(Theme.DEFAULT);
    expect(localStorage.getItem(KIALI_THEME)).toBe(Theme.DEFAULT);
  });

  it('to high contrast mode', async () => {
    render(
      <ThemeSwitchComponent contrastMode={ContrastMode.GLASS} colorScheme={ColorScheme.LIGHT} theme={Theme.DEFAULT} />
    );

    await userEvent.click(screen.getByLabelText(/Theme selection/));
    await userEvent.click(screen.getByRole('button', { name: 'High contrast' }));

    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.HIGH_CONTRAST);
    expect(localStorage.getItem(KIALI_CONTRAST_MODE)).toBe(ContrastMode.HIGH_CONTRAST);
  });

  it('does not apply changes when parent owns theme', () => {
    window.history.replaceState({}, '', '/?kiosk=/');

    render(
      <ThemeSwitchComponent contrastMode={ContrastMode.DEFAULT} colorScheme={ColorScheme.LIGHT} theme={Theme.DEFAULT} />
    );

    expect(screen.queryByLabelText(/Theme selection/)).not.toBeInTheDocument();
    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(false);
    expect(store.getState().globalState.colorScheme).toBe(ColorScheme.LIGHT);
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeSwitchComponent } from '../Masthead/ThemeSwitch';
import {
  ContrastMode,
  KIALI_COLOR_SCHEME,
  KIALI_CONTRAST_MODE,
  KIALI_THEME,
  PF_THEME_DARK,
  PF_THEME_FELT,
  PF_THEME_GLASS,
  PF_THEME_HIGH_CONTRAST,
  Theme,
  ThemeVariant
} from 'types/Common';
import { store } from 'store/ConfigStore';

describe('ThemeSwitch renders', () => {
  it('light theme', () => {
    render(
      <ThemeSwitchComponent
        contrastMode={ContrastMode.TRADITIONAL}
        colorScheme={Theme.LIGHT}
        theme={ThemeVariant.DEFAULT}
      />
    );

    expect(screen.getByLabelText(/Theme selection, current: Light/)).toBeInTheDocument();
  });

  it('dark theme', () => {
    render(
      <ThemeSwitchComponent
        contrastMode={ContrastMode.TRADITIONAL}
        colorScheme={Theme.DARK}
        theme={ThemeVariant.DEFAULT}
      />
    );

    expect(screen.getByLabelText(/Theme selection, current: Dark/)).toBeInTheDocument();
  });
});

describe('ThemeSwitch changes', () => {
  afterEach(() => {
    document.documentElement.className = '';
    localStorage.clear();
  });

  it('to dark theme', async () => {
    render(
      <ThemeSwitchComponent
        contrastMode={ContrastMode.TRADITIONAL}
        colorScheme={Theme.LIGHT}
        theme={ThemeVariant.DEFAULT}
      />
    );

    await userEvent.click(screen.getByLabelText(/Theme selection/));
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(true);
    expect(store.getState().globalState.colorScheme).toBe(Theme.DARK);
    expect(localStorage.getItem(KIALI_COLOR_SCHEME)).toBe(Theme.DARK);
  });

  it('to light theme', async () => {
    render(
      <ThemeSwitchComponent
        contrastMode={ContrastMode.TRADITIONAL}
        colorScheme={Theme.DARK}
        theme={ThemeVariant.DEFAULT}
      />
    );

    await userEvent.click(screen.getByLabelText(/Theme selection/));
    await userEvent.click(screen.getByRole('button', { name: 'Light' }));

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(false);
    expect(store.getState().globalState.colorScheme).toBe(Theme.LIGHT);
  });

  it('to glass contrast mode', async () => {
    render(
      <ThemeSwitchComponent
        contrastMode={ContrastMode.TRADITIONAL}
        colorScheme={Theme.LIGHT}
        theme={ThemeVariant.DEFAULT}
      />
    );

    await userEvent.click(screen.getByLabelText(/Theme selection/));
    await userEvent.click(screen.getByRole('button', { name: 'Glass' }));

    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.GLASS);
  });

  it('to felt with glass contrast mode', async () => {
    render(
      <ThemeSwitchComponent contrastMode={ContrastMode.GLASS} colorScheme={Theme.LIGHT} theme={ThemeVariant.DEFAULT} />
    );

    await userEvent.click(screen.getByLabelText(/Theme selection/));
    await userEvent.click(screen.getByRole('button', { name: 'Project Felt' }));

    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(true);
    expect(store.getState().globalState.theme).toBe(ThemeVariant.FELT);
    expect(localStorage.getItem(KIALI_THEME)).toBe(ThemeVariant.FELT);
  });

  it('off felt theme', async () => {
    render(
      <ThemeSwitchComponent contrastMode={ContrastMode.GLASS} colorScheme={Theme.LIGHT} theme={ThemeVariant.FELT} />
    );

    await userEvent.click(screen.getByLabelText(/Theme selection/));
    const themeToggle = document.querySelector('[data-test="theme-toggle"]') as HTMLElement;
    await userEvent.click(within(themeToggle).getByRole('button', { name: 'Default' }));

    expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(false);
    expect(store.getState().globalState.theme).toBe(ThemeVariant.DEFAULT);
    expect(localStorage.getItem(KIALI_THEME)).toBe(ThemeVariant.DEFAULT);
  });

  it('to high contrast mode', async () => {
    render(
      <ThemeSwitchComponent contrastMode={ContrastMode.GLASS} colorScheme={Theme.LIGHT} theme={ThemeVariant.DEFAULT} />
    );

    await userEvent.click(screen.getByLabelText(/Theme selection/));
    await userEvent.click(screen.getByRole('button', { name: 'High contrast' }));

    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.HIGH_CONTRAST);
    expect(localStorage.getItem(KIALI_CONTRAST_MODE)).toBe(ContrastMode.HIGH_CONTRAST);
  });
});

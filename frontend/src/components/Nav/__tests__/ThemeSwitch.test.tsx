import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeSwitchComponent } from '../Masthead/ThemeSwitch';
import { ContrastMode, PF_THEME_DARK, PF_THEME_GLASS, PF_THEME_HIGH_CONTRAST, Theme } from 'types/Common';
import { store } from 'store/ConfigStore';

describe('ThemeSwitch renders', () => {
  it('light theme with default contrast', () => {
    const { container } = render(<ThemeSwitchComponent contrastMode={ContrastMode.DEFAULT} theme={Theme.LIGHT} />);
    expect(container).toMatchSnapshot();
  });

  it('dark theme with glass contrast', () => {
    const { container } = render(<ThemeSwitchComponent contrastMode={ContrastMode.GLASS} theme={Theme.DARK} />);
    expect(container).toMatchSnapshot();
  });
});

describe('ThemeSwitch color scheme', () => {
  beforeEach(() => {
    document.documentElement.className = '';
  });

  it('switches to dark theme', async () => {
    render(<ThemeSwitchComponent contrastMode={ContrastMode.DEFAULT} theme={Theme.LIGHT} />);

    await userEvent.click(screen.getByLabelText('Dark theme'));

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(true);
    expect(store.getState().globalState.theme).toBe(Theme.DARK);
  });

  it('switches to light theme', async () => {
    render(<ThemeSwitchComponent contrastMode={ContrastMode.DEFAULT} theme={Theme.DARK} />);

    await userEvent.click(screen.getByLabelText('Light theme'));

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(false);
    expect(store.getState().globalState.theme).toBe(Theme.LIGHT);
  });
});

describe('ThemeSwitch contrast mode', () => {
  beforeEach(() => {
    document.documentElement.className = '';
  });

  it('switches to glass', async () => {
    render(<ThemeSwitchComponent contrastMode={ContrastMode.DEFAULT} theme={Theme.LIGHT} />);

    await userEvent.click(screen.getByLabelText('Glass theme'));

    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(false);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.GLASS);
  });

  it('switches to high contrast', async () => {
    render(<ThemeSwitchComponent contrastMode={ContrastMode.GLASS} theme={Theme.DARK} />);

    await userEvent.click(screen.getByLabelText('High contrast'));

    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(true);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.HIGH_CONTRAST);
  });

  it('switches back to default contrast', async () => {
    render(<ThemeSwitchComponent contrastMode={ContrastMode.HIGH_CONTRAST} theme={Theme.LIGHT} />);

    await userEvent.click(screen.getByLabelText('Default contrast'));

    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(false);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.DEFAULT);
  });
});

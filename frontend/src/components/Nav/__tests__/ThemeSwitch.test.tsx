import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeSwitchComponent } from '../Masthead/ThemeSwitch';
import {
  ContrastMode,
  PF_THEME_DARK,
  PF_THEME_FELT,
  PF_THEME_GLASS,
  PF_THEME_HIGH_CONTRAST,
  Theme
} from 'types/Common';
import { store } from 'store/ConfigStore';

describe('ThemeSwitch renders', () => {
  it('light theme', () => {
    const { container } = render(
      <ThemeSwitchComponent contrastMode={ContrastMode.TRADITIONAL} theme={Theme.LIGHT} themeFelt={false} />
    );
    expect(container).toMatchSnapshot();
  });

  it('dark theme', () => {
    const { container } = render(
      <ThemeSwitchComponent contrastMode={ContrastMode.TRADITIONAL} theme={Theme.DARK} themeFelt={false} />
    );
    expect(container).toMatchSnapshot();
  });
});

describe('ThemeSwitch changes', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it('to dark theme', async () => {
    render(<ThemeSwitchComponent contrastMode={ContrastMode.TRADITIONAL} theme={Theme.LIGHT} themeFelt={false} />);

    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[1]);

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(true);
    expect(store.getState().globalState.theme).toBe(Theme.DARK);
  });

  it('to light theme', async () => {
    render(<ThemeSwitchComponent contrastMode={ContrastMode.TRADITIONAL} theme={Theme.DARK} themeFelt={false} />);

    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[0]);

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(false);
    expect(store.getState().globalState.theme).toBe(Theme.LIGHT);
  });

  it('to glass contrast mode', async () => {
    render(<ThemeSwitchComponent contrastMode={ContrastMode.TRADITIONAL} theme={Theme.LIGHT} themeFelt={false} />);

    await userEvent.click(screen.getByLabelText('Contrast mode'));
    await userEvent.click(screen.getByRole('option', { name: 'Glass' }));

    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.GLASS);
  });

  it('to felt with glass contrast mode', async () => {
    render(<ThemeSwitchComponent contrastMode={ContrastMode.GLASS} theme={Theme.LIGHT} themeFelt={false} />);

    await userEvent.click(screen.getByTestId('theme-felt-switch').querySelector('button')!);

    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(true);
    expect(store.getState().globalState.themeFelt).toBe(true);
  });

  it('to high contrast mode', async () => {
    render(<ThemeSwitchComponent contrastMode={ContrastMode.GLASS} theme={Theme.LIGHT} themeFelt={false} />);

    await userEvent.click(screen.getByLabelText('Contrast mode'));
    await userEvent.click(screen.getByRole('option', { name: 'High contrast' }));

    expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(true);
    expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
    expect(store.getState().globalState.contrastMode).toBe(ContrastMode.HIGH_CONTRAST);
  });
});

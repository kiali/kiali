import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeSwitchComponent } from '../Masthead/ThemeSwitch';
import { PF_THEME_DARK, Theme } from 'types/Common';
import { store } from 'store/ConfigStore';

describe('ThemeSwitch renders', () => {
  it('light theme', () => {
    const { container } = render(<ThemeSwitchComponent theme={Theme.LIGHT} />);
    expect(container).toMatchSnapshot();
  });

  it('dark theme', () => {
    const { container } = render(<ThemeSwitchComponent theme={Theme.DARK} />);
    expect(container).toMatchSnapshot();
  });
});

describe('ThemeSwitch changes', () => {
  it('to dark theme', async () => {
    render(<ThemeSwitchComponent theme={Theme.LIGHT} />);

    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[1]);

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(true);
    expect(store.getState().globalState.theme).toBe(Theme.DARK);
  });

  it('to light theme', async () => {
    render(<ThemeSwitchComponent theme={Theme.DARK} />);

    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[0]);

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(false);
    expect(store.getState().globalState.theme).toBe(Theme.LIGHT);
  });
});

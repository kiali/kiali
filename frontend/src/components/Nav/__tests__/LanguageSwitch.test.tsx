import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageSwitchComponent } from '../Masthead/LanguageSwitch';
import { Language } from 'types/Common';
import { serverConfig, setServerConfig } from 'config/ServerConfig';
import { store } from 'store/ConfigStore';

const i18nServerConfig = Object.assign({}, serverConfig);

describe('Language switch', () => {
  beforeAll(() => {
    setServerConfig(i18nServerConfig);
  });

  it('renders correctly', () => {
    const { container } = render(<LanguageSwitchComponent language={Language.ENGLISH} />);
    expect(container).toMatchSnapshot();
  });

  it('changes to english language', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitchComponent language={Language.CHINESE} />);

    await user.click(screen.getByRole('button', { name: /switch language/i }));
    await user.click(await screen.findByText('English'));

    await waitFor(() => {
      expect(store.getState().globalState.language).toBe(Language.ENGLISH);
    });
  });

  it('changes to spanish language', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitchComponent language={Language.ENGLISH} />);

    await user.click(screen.getByRole('button', { name: /switch language/i }));
    await user.click(await screen.findByText('Español'));

    await waitFor(() => {
      expect(store.getState().globalState.language).toBe(Language.SPANISH);
    });
  });

  it('changes to chinese language', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitchComponent language={Language.ENGLISH} />);

    await user.click(screen.getByRole('button', { name: /switch language/i }));
    await user.click(await screen.findByText('中文'));

    await waitFor(() => {
      expect(store.getState().globalState.language).toBe(Language.CHINESE);
    });
  });
});

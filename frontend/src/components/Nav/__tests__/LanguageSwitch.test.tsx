import * as React from 'react';
import { render } from '@testing-library/react';
import { LanguageSwitchComponent } from '../Masthead/LanguageSwitch';
import { Language } from 'types/Common';
import { serverConfig, setServerConfig } from 'config/ServerConfig';

const i18nServerConfig = Object.assign({}, serverConfig);

describe('Language switch', () => {
  beforeAll(() => {
    setServerConfig(i18nServerConfig);
  });

  it('renders correctly', () => {
    const { container } = render(<LanguageSwitchComponent language={Language.ENGLISH} />);
    expect(container).toMatchSnapshot();
  });
});

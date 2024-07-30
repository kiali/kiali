import * as React from 'react';
import { shallowToJson } from 'enzyme-to-json';
import { mount, shallow } from 'enzyme';
import { LanguageSwitchComponent } from '../Masthead/LanguageSwitch';
import { MenuToggle } from '@patternfly/react-core';
import { store } from 'store/ConfigStore';
import { Language } from 'types/Common';
import { serverConfig, setServerConfig } from 'config/ServerConfig';

const i18nServerConfig = Object.assign({}, serverConfig);

const delay = (ms: number): Promise<void> => new Promise(res => setTimeout(res, ms));

describe('Language switch', () => {
  beforeAll(() => {
    setServerConfig(i18nServerConfig);
  });
  it('renders correctly', () => {
    const wrapper = shallow(<LanguageSwitchComponent language={Language.ENGLISH} />);

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('changes to english language', async () => {
    const wrapper = mount(<LanguageSwitchComponent language={Language.CHINESE} />);

    // click menu toggle
    wrapper.find(MenuToggle).simulate('click');

    // select English option
    wrapper
      .findWhere(node => node.key() === 'english')
      .findWhere(node => node.type() === 'button')
      .simulate('click');

    // wait a few ms for the language to be modified
    await delay(100);

    expect(store.getState().globalState.language).toBe(Language.ENGLISH);
  });

  it('changes to spanish language', async () => {
    const wrapper = mount(<LanguageSwitchComponent language={Language.ENGLISH} />);

    // click menu toggle
    wrapper.find(MenuToggle).simulate('click');

    // select Chinese option
    wrapper
      .findWhere(node => node.key() === 'spanish')
      .findWhere(node => node.type() === 'button')
      .simulate('click');

    // wait a few ms for the language to be modified
    await delay(100);

    expect(store.getState().globalState.language).toBe(Language.SPANISH);
  });

  it('changes to chinese language', async () => {
    const wrapper = mount(<LanguageSwitchComponent language={Language.ENGLISH} />);

    // click menu toggle
    wrapper.find(MenuToggle).simulate('click');

    // select Chinese option
    wrapper
      .findWhere(node => node.key() === 'chinese')
      .findWhere(node => node.type() === 'button')
      .simulate('click');

    // wait a few ms for the language to be modified
    await delay(100);

    expect(store.getState().globalState.language).toBe(Language.CHINESE);
  });
});

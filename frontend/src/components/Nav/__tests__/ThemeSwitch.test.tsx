import * as React from 'react';
import { shallowToJson } from 'enzyme-to-json';
import { mount, shallow } from 'enzyme';
import { ThemeSwitchComponent } from '../Masthead/ThemeSwitch';
import { PF_THEME_DARK, Theme } from 'types/Common';
import { Button } from '@patternfly/react-core';
import { store } from 'store/ConfigStore';

describe('ThemeSwitch renders', () => {
  it('light theme', () => {
    const wrapper = shallow(<ThemeSwitchComponent theme={Theme.LIGHT} />);

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('dark theme', () => {
    const wrapper = shallow(<ThemeSwitchComponent theme={Theme.DARK} />);

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });
});

describe('ThemeSwitch changes', () => {
  it('to dark theme', () => {
    const wrapper = mount(<ThemeSwitchComponent theme={Theme.LIGHT} />);

    // Click dark button
    wrapper.find(Button).at(1).simulate('click');

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(true);
    expect(store.getState().globalState.theme).toBe(Theme.DARK);
  });

  it('to light theme', () => {
    const wrapper = mount(<ThemeSwitchComponent theme={Theme.DARK} />);

    // Click light button
    wrapper.find(Button).at(0).simulate('click');

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(false);
    expect(store.getState().globalState.theme).toBe(Theme.LIGHT);
  });
});

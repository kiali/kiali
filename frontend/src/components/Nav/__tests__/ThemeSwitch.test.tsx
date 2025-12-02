import * as React from 'react';
import { shallowToJson } from 'enzyme-to-json';
import { mount, shallow } from 'enzyme';
import { ThemeSwitchComponent } from '../Masthead/ThemeSwitch';
import { PF_THEME_DARK, Theme } from 'types/Common';
import { ToggleGroupItem } from '@patternfly/react-core';
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

    // Click dark button (second ToggleGroupItem)
    const darkButton = wrapper.find(ToggleGroupItem).at(1).find('button');
    darkButton.simulate('click');

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(true);
    expect(store.getState().globalState.theme).toBe(Theme.DARK);
  });

  it('to light theme', () => {
    const wrapper = mount(<ThemeSwitchComponent theme={Theme.DARK} />);

    // Click light button (first ToggleGroupItem)
    const lightButton = wrapper.find(ToggleGroupItem).at(0).find('button');
    lightButton.simulate('click');

    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(false);
    expect(store.getState().globalState.theme).toBe(Theme.LIGHT);
  });
});

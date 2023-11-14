import * as React from 'react';
import { shallowToJson } from 'enzyme-to-json';
import { mount, shallow } from 'enzyme';
import { ThemeSwitchComponent } from '../Masthead/ThemeSwitch';
import { KIALI_THEME, PF_THEME_DARK, Theme } from 'types/Common';
import { Button } from '@patternfly/react-core';

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
    var buttonLight = () => wrapper.find(Button).at(0);
    buttonLight().simulate('click');
    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(true);
    expect(window.localStorage.getItem(KIALI_THEME)).toBe(Theme.DARK);
  });

  it('to light theme', () => {
    const wrapper = mount(<ThemeSwitchComponent theme={Theme.DARK} />);
    var buttonDark = () => wrapper.find(Button).at(1);
    buttonDark().simulate('click');
    expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(false);
    expect(window.localStorage.getItem(KIALI_THEME)).toBe(Theme.LIGHT);
  });
});

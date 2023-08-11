import React from 'react';
import { Switch } from '@patternfly/react-core';
import { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';
import { KIALI_THEME, PF_THEME_DARK, Theme } from 'types/Common';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';

type ThemeSwitchProps = {
  theme: string;
};

export const ThemeSwitchComponent = (props: ThemeSwitchProps) => {
  const handleTheme = () => {
    if (props.theme === Theme.LIGHT) {
      document.documentElement.classList.add(PF_THEME_DARK);
      store.dispatch(GlobalActions.setTheme(Theme.DARK));
      localStorage.setItem(KIALI_THEME, Theme.DARK);
    } else {
      document.documentElement.classList.remove(PF_THEME_DARK);
      store.dispatch(GlobalActions.setTheme(Theme.LIGHT));
      localStorage.setItem(KIALI_THEME, Theme.LIGHT);
    }

    // Refresh page to load new theme (certain components are not reloaded like cytoscape graph)
    const refreshTick = new CustomEvent('refreshTick', { detail: Date.now() });
    document.dispatchEvent(refreshTick);
  };

  return (
    <Switch
      id="theme-switch"
      label={'Dark Theme'}
      labelOff={'Dark Theme'}
      isChecked={props.theme === Theme.DARK}
      onChange={handleTheme}
    />
  );
};

const mapStateToProps = (state: KialiAppState) => {
  return {
    theme: state.globalState.theme
  };
};

export const ThemeSwitch = connect(mapStateToProps)(ThemeSwitchComponent);

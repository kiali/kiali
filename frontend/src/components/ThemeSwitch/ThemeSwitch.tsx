import React from 'react';
import { Button, Icon, Tooltip } from '@patternfly/react-core';
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

  const darkTheme = props.theme === Theme.DARK;

  return (
    <>
      <Tooltip position="bottom" content={<>{`${darkTheme ? 'Enable' : 'Disable'} Light Mode`}</>}>
        <Button variant={darkTheme ? 'secondary' : 'primary'} onClick={handleTheme}>
          <Icon>
            <i className="fas fa-sun" />
          </Icon>
        </Button>
      </Tooltip>
      <Tooltip position="bottom" content={<>{`${darkTheme ? 'Disable' : 'Enable'} Dark Mode`}</>}>
        <Button variant={darkTheme ? 'primary' : 'secondary'} onClick={handleTheme}>
          <Icon>
            <i className="fas fa-moon" />
          </Icon>
        </Button>
      </Tooltip>
    </>
  );
};

const mapStateToProps = (state: KialiAppState) => {
  return {
    theme: state.globalState.theme
  };
};

export const ThemeSwitch = connect(mapStateToProps)(ThemeSwitchComponent);

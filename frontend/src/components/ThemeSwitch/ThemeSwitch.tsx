import React from 'react';
import { Button, Tooltip } from '@patternfly/react-core';
import { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';
import { KIALI_THEME, PF_THEME_DARK, Theme } from 'types/Common';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { classes } from 'typestyle';

const iconStyle = kialiStyle({
  color: PFColors.Color100
});

const buttonStyle = kialiStyle({
  $nest: {
    '&.pf-m-primary': {
      backgroundColor: PFColors.Blue400,
      $nest: {
        '&::after': {
          border: `1px solid ${PFColors.Blue200}`
        }
      }
    },
    '&.pf-m-secondary::after': {
      border: `1px solid ${PFColors.Color400}`
    }
  }
});

const lightButtonStyle = kialiStyle({
  borderTopRightRadius: 0,
  borderBottomRightRadius: 0,
  $nest: {
    '&::after': {
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0
    },
    '&&.pf-m-secondary::after': {
      borderRight: 0
    }
  }
});

const darkButtonStyle = kialiStyle({
  borderTopLeftRadius: 0,
  borderBottomLeftRadius: 0,
  $nest: {
    '&::after': {
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0
    },
    '&&.pf-m-secondary::after': {
      borderLeft: 0
    }
  }
});

type ThemeSwitchProps = {
  theme: string;
};

export const ThemeSwitchComponent: React.FC<ThemeSwitchProps> = (props: ThemeSwitchProps) => {
  const darkTheme = props.theme === Theme.DARK;

  const handleTheme = () => {
    const theme = darkTheme ? Theme.LIGHT : Theme.DARK;

    document.documentElement.classList.toggle(PF_THEME_DARK);
    store.dispatch(GlobalActions.setTheme(theme));
    localStorage.setItem(KIALI_THEME, theme);

    // Refresh page to load new theme (certain components are not reloaded like cytoscape graph)
    const refreshTick = new CustomEvent('refreshTick', { detail: Date.now() });
    document.dispatchEvent(refreshTick);
  };

  return (
    <Tooltip
      position="bottom"
      content={<>{`${$t('SwitchTo', 'Switch to ')}${darkTheme ? $t('Light') : $t('Dark')}${$t('Mode', ' Mode')}`}</>}
    >
      <div>
        <Button
          variant={darkTheme ? 'secondary' : 'primary'}
          className={classes(buttonStyle, lightButtonStyle)}
          onClick={handleTheme}
        >
          <KialiIcon.Sun className={iconStyle}></KialiIcon.Sun>
        </Button>
        <Button
          variant={darkTheme ? 'primary' : 'secondary'}
          className={classes(buttonStyle, darkButtonStyle)}
          onClick={handleTheme}
        >
          <KialiIcon.Moon className={iconStyle}></KialiIcon.Moon>
        </Button>
      </div>
    </Tooltip>
  );
};

const mapStateToProps = (state: KialiAppState) => {
  return {
    theme: state.globalState.theme
  };
};

export const ThemeSwitch = connect(mapStateToProps)(ThemeSwitchComponent);

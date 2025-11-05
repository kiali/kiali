import * as React from 'react';
import { ToggleGroup, ToggleGroupItem, Tooltip } from '@patternfly/react-core';
import { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';
import { KIALI_THEME, PF_THEME_DARK, Theme } from 'types/Common';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { KialiIcon } from 'config/KialiIcon';
import { useKialiTranslation } from 'utils/I18nUtils';

type ThemeSwitchProps = {
  theme: string;
};

export const ThemeSwitchComponent: React.FC<ThemeSwitchProps> = (props: ThemeSwitchProps) => {
  const { t } = useKialiTranslation();

  const darkTheme = props.theme === Theme.DARK;

  const handleTheme = (): void => {
    const theme = darkTheme ? Theme.LIGHT : Theme.DARK;

    document.documentElement.classList.toggle(PF_THEME_DARK);
    store.dispatch(GlobalActions.setTheme(theme));
    localStorage.setItem(KIALI_THEME, theme);
  };

  return (
    <ToggleGroup>
      <Tooltip content={t('Switch to {{theme}} Mode', { theme: darkTheme ? 'Light' : 'Dark' })}>
        <ToggleGroupItem icon={<KialiIcon.Sun />} onClick={handleTheme} isSelected={!darkTheme} />
      </Tooltip>
      <Tooltip content={t('Switch to {{theme}} Mode', { theme: darkTheme ? 'Light' : 'Dark' })}>
        <ToggleGroupItem icon={<KialiIcon.Moon />} onClick={handleTheme} isSelected={darkTheme} />
      </Tooltip>
    </ToggleGroup>
  );
};

const mapStateToProps = (state: KialiAppState): ThemeSwitchProps => {
  return {
    theme: state.globalState.theme
  };
};

export const ThemeSwitch = connect(mapStateToProps)(ThemeSwitchComponent);

import * as React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@patternfly/react-core';
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
    <ToggleGroup aria-label={t('Theme switch')}>
      <ToggleGroupItem
        aria-label={t('Light theme')}
        icon={<KialiIcon.Sun isInline />}
        isSelected={!darkTheme}
        onClick={handleTheme}
      />
      <ToggleGroupItem
        aria-label={t('Dark theme')}
        icon={<KialiIcon.Moon isInline />}
        isSelected={darkTheme}
        onClick={handleTheme}
      />
    </ToggleGroup>
  );
};

const mapStateToProps = (state: KialiAppState): ThemeSwitchProps => {
  return {
    theme: state.globalState.theme
  };
};

export const ThemeSwitch = connect(mapStateToProps)(ThemeSwitchComponent);

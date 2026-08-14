import * as React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@patternfly/react-core';
import type { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';
import { KIALI_THEME, Theme } from 'types/Common';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { KialiIcon } from 'config/KialiIcon';
import { useKialiTranslation } from 'utils/I18nUtils';
import { applyDocumentTheme } from 'utils/ThemeUtils';

type ThemeSwitchProps = {
  theme: string;
};

export const ThemeSwitchComponent: React.FC<ThemeSwitchProps> = (props: ThemeSwitchProps) => {
  const { t } = useKialiTranslation();
  const darkTheme = props.theme === Theme.DARK;

  const handleTheme = (): void => {
    const theme = darkTheme ? Theme.LIGHT : Theme.DARK;

    applyDocumentTheme(theme);
    store.dispatch(GlobalActions.setTheme(theme));
    localStorage.setItem(KIALI_THEME, theme);
  };

  return (
    <ToggleGroup aria-label={t('Theme switch')} data-test="theme-switch">
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

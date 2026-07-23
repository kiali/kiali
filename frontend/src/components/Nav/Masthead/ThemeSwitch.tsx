import * as React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@patternfly/react-core';
import type { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';
import { ContrastMode, KIALI_CONTRAST_MODE, KIALI_THEME, Theme } from 'types/Common';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { KialiIcon } from 'config/KialiIcon';
import { useKialiTranslation } from 'utils/I18nUtils';
import { applyDocumentTheme } from 'utils/ThemeUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';

type ThemeSwitchProps = {
  contrastMode: string;
  theme: string;
};

const themeSwitchStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  gap: PFSpacer.sm
});

export const ThemeSwitchComponent: React.FC<ThemeSwitchProps> = (props: ThemeSwitchProps) => {
  const { t } = useKialiTranslation();
  const theme = (props.theme as Theme) || Theme.LIGHT;
  const contrastMode = (props.contrastMode as ContrastMode) || ContrastMode.DEFAULT;
  const darkTheme = theme === Theme.DARK;

  const handleTheme = (nextTheme: Theme): void => {
    applyDocumentTheme(nextTheme, contrastMode);
    store.dispatch(GlobalActions.setTheme(nextTheme));
    localStorage.setItem(KIALI_THEME, nextTheme);
  };

  const handleContrastMode = (nextContrastMode: ContrastMode): void => {
    applyDocumentTheme(theme, nextContrastMode);
    store.dispatch(GlobalActions.setContrastMode(nextContrastMode));
    localStorage.setItem(KIALI_CONTRAST_MODE, nextContrastMode);
  };

  return (
    <div className={themeSwitchStyle} data-test="theme-switch">
      <ToggleGroup aria-label={t('Color scheme')} isCompact>
        <ToggleGroupItem
          aria-label={t('Light theme')}
          buttonId="theme-light"
          data-test="theme-light"
          icon={<KialiIcon.Sun isInline />}
          isSelected={!darkTheme}
          onChange={() => handleTheme(Theme.LIGHT)}
          title={t('Light theme')}
        />
        <ToggleGroupItem
          aria-label={t('Dark theme')}
          buttonId="theme-dark"
          data-test="theme-dark"
          icon={<KialiIcon.Moon isInline />}
          isSelected={darkTheme}
          onChange={() => handleTheme(Theme.DARK)}
          title={t('Dark theme')}
        />
      </ToggleGroup>

      <ToggleGroup aria-label={t('Contrast mode')} isCompact>
        <ToggleGroupItem
          aria-label={t('Default contrast')}
          buttonId="contrast-default"
          data-test="contrast-default"
          icon={<KialiIcon.Equalizer isInline />}
          isSelected={contrastMode === ContrastMode.DEFAULT}
          onChange={() => handleContrastMode(ContrastMode.DEFAULT)}
          title={t('Default contrast')}
        />
        <ToggleGroupItem
          aria-label={t('Glass theme')}
          buttonId="contrast-glass"
          data-test="contrast-glass"
          icon={<KialiIcon.Glasses isInline />}
          isSelected={contrastMode === ContrastMode.GLASS}
          onChange={() => handleContrastMode(ContrastMode.GLASS)}
          title={t('Glass theme')}
        />
        <ToggleGroupItem
          aria-label={t('High contrast')}
          buttonId="contrast-high"
          data-test="contrast-high"
          icon={<KialiIcon.Adjust isInline />}
          isSelected={contrastMode === ContrastMode.HIGH_CONTRAST}
          onChange={() => handleContrastMode(ContrastMode.HIGH_CONTRAST)}
          title={t('High contrast')}
        />
      </ToggleGroup>
    </div>
  );
};

const mapStateToProps = (state: KialiAppState): ThemeSwitchProps => {
  return {
    contrastMode: state.globalState.contrastMode,
    theme: state.globalState.theme
  };
};

export const ThemeSwitch = connect(mapStateToProps)(ThemeSwitchComponent);

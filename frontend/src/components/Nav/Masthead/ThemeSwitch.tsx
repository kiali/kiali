import * as React from 'react';
import { MenuToggle, Select, SelectList, SelectOption, ToggleGroup, ToggleGroupItem } from '@patternfly/react-core';
import type { MenuToggleElement } from '@patternfly/react-core';
import type { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';
import { ContrastMode, KIALI_CONTRAST_MODE, KIALI_THEME, KIALI_THEME_FELT, Theme } from 'types/Common';
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
  themeFelt: boolean;
};

const themeSwitchStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  gap: PFSpacer.sm
});

const getContrastModeLabel = (contrastMode: ContrastMode, t: (key: string) => string): string => {
  switch (contrastMode) {
    case ContrastMode.TRADITIONAL:
      return t('Traditional');
    case ContrastMode.GLASS:
      return t('Glass');
    case ContrastMode.HIGH_CONTRAST:
      return t('High contrast');
  }
};

export const ThemeSwitchComponent: React.FC<ThemeSwitchProps> = (props: ThemeSwitchProps) => {
  const { t } = useKialiTranslation();
  const [isContrastOpen, setIsContrastOpen] = React.useState<boolean>(false);
  const darkTheme = props.theme === Theme.DARK;
  const contrastMode = props.contrastMode as ContrastMode;

  const applyTheme = (theme: Theme, mode: ContrastMode, themeFelt: boolean): void => {
    applyDocumentTheme(theme, mode, themeFelt);
    store.dispatch(GlobalActions.setTheme(theme));
    store.dispatch(GlobalActions.setContrastMode(mode));
    store.dispatch(GlobalActions.setThemeFelt(themeFelt));
    localStorage.setItem(KIALI_THEME, theme);
    localStorage.setItem(KIALI_CONTRAST_MODE, mode);
    localStorage.setItem(KIALI_THEME_FELT, String(themeFelt));
  };

  const handleTheme = (): void => {
    const theme = darkTheme ? Theme.LIGHT : Theme.DARK;
    applyTheme(theme, contrastMode, props.themeFelt);
  };

  const handleContrastSelect = (mode: ContrastMode): void => {
    applyTheme(props.theme as Theme, mode, props.themeFelt);
    setIsContrastOpen(false);
  };

  const handleFeltToggle = (): void => {
    applyTheme(props.theme as Theme, contrastMode, !props.themeFelt);
  };

  return (
    <div className={themeSwitchStyle}>
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

      <ToggleGroup aria-label={t('Felt')} data-test="theme-felt-switch">
        <ToggleGroupItem
          aria-label={t('Felt')}
          isSelected={props.themeFelt}
          onClick={handleFeltToggle}
          text={t('Felt')}
        />
      </ToggleGroup>

      <Select
        data-test="contrast-mode-switch"
        id="contrast-mode-select"
        isOpen={isContrastOpen}
        selected={contrastMode}
        onOpenChange={setIsContrastOpen}
        onSelect={(_event, value) => handleContrastSelect(value as ContrastMode)}
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            aria-label={t('Contrast mode')}
            isExpanded={isContrastOpen}
            onClick={() => setIsContrastOpen(!isContrastOpen)}
          >
            {getContrastModeLabel(contrastMode, t)}
          </MenuToggle>
        )}
      >
        <SelectList>
          <SelectOption isSelected={contrastMode === ContrastMode.TRADITIONAL} value={ContrastMode.TRADITIONAL}>
            {t('Traditional')}
          </SelectOption>
          <SelectOption isSelected={contrastMode === ContrastMode.GLASS} value={ContrastMode.GLASS}>
            {t('Glass')}
          </SelectOption>
          <SelectOption isSelected={contrastMode === ContrastMode.HIGH_CONTRAST} value={ContrastMode.HIGH_CONTRAST}>
            {t('High contrast')}
          </SelectOption>
        </SelectList>
      </Select>
    </div>
  );
};

const mapStateToProps = (state: KialiAppState): ThemeSwitchProps => {
  return {
    contrastMode: state.globalState.contrastMode,
    theme: state.globalState.theme,
    themeFelt: state.globalState.themeFelt
  };
};

export const ThemeSwitch = connect(mapStateToProps)(ThemeSwitchComponent);

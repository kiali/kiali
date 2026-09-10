import * as React from 'react';
import {
  Divider,
  Icon,
  MenuSearch,
  MenuSearchInput,
  MenuToggle,
  Select,
  SelectGroup,
  ToggleGroup,
  ToggleGroupItem
} from '@patternfly/react-core';
import type { MenuToggleElement } from '@patternfly/react-core';
import { AdjustIcon } from '@patternfly/react-icons';
import type { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';
import { ContrastMode, KIALI_CONTRAST_MODE, KIALI_THEME, KIALI_THEME_FELT, Theme } from 'types/Common';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { useKialiTranslation } from 'utils/I18nUtils';
import { applyDocumentTheme } from 'utils/ThemeUtils';

type ThemeSwitchProps = {
  contrastMode: string;
  theme: string;
  themeFelt: boolean;
};

const THEME_VARIANT_DEFAULT = 'theme-default';
const THEME_VARIANT_FELT = 'theme-felt';

const ThemeGroupLabel: React.FC<{ id: string; label: string }> = ({ id, label }) => (
  <div className="pf-v6-c-menu__group-title" id={id}>
    {label}
  </div>
);

const getThemeDisplayText = (theme: Theme, t: (key: string) => string): string => {
  return theme === Theme.DARK ? t('Dark') : t('Light');
};

export const ThemeSwitchComponent: React.FC<ThemeSwitchProps> = (props: ThemeSwitchProps) => {
  const { t } = useKialiTranslation();
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  const theme = props.theme as Theme;
  const contrastMode = props.contrastMode as ContrastMode;

  const applyTheme = (nextTheme: Theme, nextContrastMode: ContrastMode, themeFelt: boolean): void => {
    applyDocumentTheme(nextTheme, nextContrastMode, themeFelt);
    store.dispatch(GlobalActions.setTheme(nextTheme));
    store.dispatch(GlobalActions.setContrastMode(nextContrastMode));
    store.dispatch(GlobalActions.setThemeFelt(themeFelt));
    localStorage.setItem(KIALI_THEME, nextTheme);
    localStorage.setItem(KIALI_CONTRAST_MODE, nextContrastMode);
    localStorage.setItem(KIALI_THEME_FELT, String(themeFelt));
  };

  const handleThemeVariantChange = (event: React.MouseEvent | React.KeyboardEvent | MouseEvent): void => {
    const themeFelt = (event.currentTarget as HTMLElement).id === THEME_VARIANT_FELT;
    applyTheme(theme, contrastMode, themeFelt);
  };

  const handleThemeChange = (event: React.MouseEvent | React.KeyboardEvent | MouseEvent): void => {
    applyTheme((event.currentTarget as HTMLElement).id as Theme, contrastMode, props.themeFelt);
  };

  const handleContrastModeChange = (event: React.MouseEvent | React.KeyboardEvent | MouseEvent): void => {
    applyTheme(theme, (event.currentTarget as HTMLElement).id as ContrastMode, props.themeFelt);
  };

  return (
    <Select
      data-test="theme-switch"
      id="theme-selector"
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      popperProps={{
        enableFlip: true,
        position: 'right',
        preventOverflow: true
      }}
      shouldFocusToggleOnSelect
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          aria-label={`${t('Theme selection')}, ${t('current')}: ${getThemeDisplayText(theme, t)}`}
          icon={
            <Icon size="lg">
              <AdjustIcon />
            </Icon>
          }
          isExpanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
        />
      )}
    >
      <SelectGroup label={<ThemeGroupLabel id="theme-selector-color-scheme-title" label={t('Color scheme')} />}>
        <MenuSearch>
          <MenuSearchInput>
            <ToggleGroup aria-labelledby="theme-selector-color-scheme-title" data-test="theme-color-scheme-switch">
              <ToggleGroupItem
                buttonId={Theme.LIGHT}
                isSelected={theme === Theme.LIGHT}
                onChange={handleThemeChange}
                text={t('Light')}
              />
              <ToggleGroupItem
                buttonId={Theme.DARK}
                isSelected={theme === Theme.DARK}
                onChange={handleThemeChange}
                text={t('Dark')}
              />
            </ToggleGroup>
          </MenuSearchInput>
        </MenuSearch>
      </SelectGroup>
      <Divider />
      <SelectGroup label={<ThemeGroupLabel id="theme-selector-variant-title" label={t('Theme')} />}>
        <MenuSearch>
          <MenuSearchInput>
            <ToggleGroup aria-labelledby="theme-selector-variant-title" data-test="theme-felt-switch">
              <ToggleGroupItem
                buttonId={THEME_VARIANT_DEFAULT}
                isSelected={!props.themeFelt}
                onChange={handleThemeVariantChange}
                text={t('Default')}
              />
              <ToggleGroupItem
                buttonId={THEME_VARIANT_FELT}
                isSelected={props.themeFelt}
                onChange={handleThemeVariantChange}
                text={t('Project Felt')}
              />
            </ToggleGroup>
          </MenuSearchInput>
        </MenuSearch>
      </SelectGroup>
      <Divider />
      <SelectGroup label={<ThemeGroupLabel id="theme-selector-contrast-title" label={t('Contrast mode')} />}>
        <MenuSearch>
          <MenuSearchInput>
            <ToggleGroup aria-labelledby="theme-selector-contrast-title" data-test="contrast-mode-switch">
              <ToggleGroupItem
                buttonId={ContrastMode.TRADITIONAL}
                isSelected={contrastMode === ContrastMode.TRADITIONAL}
                onChange={handleContrastModeChange}
                text={t('Default')}
              />
              <ToggleGroupItem
                buttonId={ContrastMode.GLASS}
                isSelected={contrastMode === ContrastMode.GLASS}
                onChange={handleContrastModeChange}
                text={t('Glass')}
              />
              <ToggleGroupItem
                buttonId={ContrastMode.HIGH_CONTRAST}
                isSelected={contrastMode === ContrastMode.HIGH_CONTRAST}
                onChange={handleContrastModeChange}
                text={t('High contrast')}
              />
            </ToggleGroup>
          </MenuSearchInput>
        </MenuSearch>
      </SelectGroup>
    </Select>
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

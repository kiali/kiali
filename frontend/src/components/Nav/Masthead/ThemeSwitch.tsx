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
import { ColorScheme, ContrastMode, Theme } from 'types/Common';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { useKialiTranslation } from 'utils/I18nUtils';
import {
  applyDocumentTheme,
  getKialiColorScheme,
  getKialiContrastMode,
  getKialiTheme,
  isFeltTheme,
  isParentOwnedTheme,
  persistKialiThemePreferences
} from 'utils/ThemeUtils';

type ReduxProps = {
  colorScheme: string;
  contrastMode: string;
  theme: string;
};

const COLOR_SCHEME_DARK = 'color-scheme-dark';
const COLOR_SCHEME_LIGHT = 'color-scheme-light';
const THEME_DEFAULT = 'theme-default';
const THEME_FELT = 'theme-felt';
const CONTRAST_MODE_DEFAULT = 'contrast-mode-default';
const CONTRAST_MODE_GLASS = 'contrast-mode-glass';
const CONTRAST_MODE_HIGH_CONTRAST = 'contrast-mode-high-contrast';

const isValidColorScheme = (colorScheme: string): colorScheme is ColorScheme => {
  return colorScheme === ColorScheme.LIGHT || colorScheme === ColorScheme.DARK;
};

const isValidContrastMode = (contrastMode: string): contrastMode is ContrastMode => {
  return (
    contrastMode === ContrastMode.DEFAULT ||
    contrastMode === ContrastMode.GLASS ||
    contrastMode === ContrastMode.HIGH_CONTRAST
  );
};

const isValidTheme = (theme: string): theme is Theme => {
  return theme === Theme.DEFAULT || theme === Theme.FELT;
};

const ThemeGroupLabel: React.FC<{ id: string; label: string }> = ({ id, label }) => (
  <div className="pf-v6-c-menu__group-title" id={id}>
    {label}
  </div>
);

const getColorSchemeDisplayText = (colorScheme: ColorScheme, t: (key: string) => string): string => {
  return colorScheme === ColorScheme.DARK ? t('Dark') : t('Light');
};

const getContrastModeDisplayText = (contrastMode: ContrastMode, t: (key: string) => string): string => {
  if (contrastMode === ContrastMode.GLASS) {
    return t('Glass');
  }

  if (contrastMode === ContrastMode.HIGH_CONTRAST) {
    return t('High contrast');
  }

  return t('Default');
};

const getAppearanceAriaLabel = (
  colorScheme: ColorScheme,
  contrastMode: ContrastMode,
  theme: Theme,
  t: (key: string) => string
): string => {
  const parts = [getColorSchemeDisplayText(colorScheme, t)];

  if (isFeltTheme(theme)) {
    parts.push(t('Project Felt'));
  }

  parts.push(getContrastModeDisplayText(contrastMode, t));

  return `${t('Theme selection')}, ${t('current')}: ${parts.join(', ')}`;
};

export const ThemeSwitchComponent: React.FC<ReduxProps> = (props: ReduxProps) => {
  const { t } = useKialiTranslation();
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  const colorScheme = isValidColorScheme(props.colorScheme) ? props.colorScheme : getKialiColorScheme();
  const contrastMode = isValidContrastMode(props.contrastMode) ? props.contrastMode : getKialiContrastMode();
  const theme = isValidTheme(props.theme) ? props.theme : getKialiTheme();

  if (isParentOwnedTheme()) {
    return null;
  }

  const applyTheme = (nextColorScheme: ColorScheme, nextContrastMode: ContrastMode, nextTheme: Theme): void => {
    applyDocumentTheme(nextColorScheme, nextContrastMode, nextTheme);
    store.dispatch(GlobalActions.setColorScheme(nextColorScheme));
    store.dispatch(GlobalActions.setContrastMode(nextContrastMode));
    store.dispatch(GlobalActions.setTheme(nextTheme));
    persistKialiThemePreferences(nextColorScheme, nextContrastMode, nextTheme);
  };

  const handleMenuToggleClick = (): void => {
    setIsOpen(open => !open);
  };

  const handleColorSchemeChange = (event: React.MouseEvent | React.KeyboardEvent | MouseEvent): void => {
    const buttonId = (event.currentTarget as HTMLElement).id;
    const nextColorScheme = buttonId === COLOR_SCHEME_DARK ? ColorScheme.DARK : ColorScheme.LIGHT;
    applyTheme(nextColorScheme, contrastMode, theme);
  };

  const handleThemeChange = (event: React.MouseEvent | React.KeyboardEvent | MouseEvent): void => {
    const buttonId = (event.currentTarget as HTMLElement).id;
    const nextTheme = buttonId === THEME_FELT ? Theme.FELT : Theme.DEFAULT;
    applyTheme(colorScheme, contrastMode, nextTheme);
  };

  const handleContrastModeChange = (event: React.MouseEvent | React.KeyboardEvent | MouseEvent): void => {
    const buttonId = (event.currentTarget as HTMLElement).id;
    let nextContrastMode: ContrastMode | undefined;

    if (buttonId === CONTRAST_MODE_GLASS) {
      nextContrastMode = ContrastMode.GLASS;
    } else if (buttonId === CONTRAST_MODE_HIGH_CONTRAST) {
      nextContrastMode = ContrastMode.HIGH_CONTRAST;
    } else if (buttonId === CONTRAST_MODE_DEFAULT) {
      nextContrastMode = ContrastMode.DEFAULT;
    }

    if (nextContrastMode) {
      applyTheme(colorScheme, nextContrastMode, theme);
    }
  };

  return (
    <Select
      id="theme-selector"
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      popperProps={{
        enableFlip: true,
        position: 'right',
        preventOverflow: true
      }}
      shouldFocusToggleOnSelect={false}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          aria-label={getAppearanceAriaLabel(colorScheme, contrastMode, theme, t)}
          data-test="theme-dropdown"
          icon={
            <Icon size="lg">
              <AdjustIcon />
            </Icon>
          }
          isExpanded={isOpen}
          onClick={handleMenuToggleClick}
        />
      )}
    >
      <SelectGroup label={<ThemeGroupLabel id="theme-selector-color-scheme-title" label={t('Color scheme')} />}>
        <MenuSearch>
          <MenuSearchInput>
            <ToggleGroup aria-labelledby="theme-selector-color-scheme-title" data-test="color-scheme-toggle">
              <ToggleGroupItem
                buttonId={COLOR_SCHEME_LIGHT}
                isSelected={colorScheme === ColorScheme.LIGHT}
                onChange={handleColorSchemeChange}
                text={t('Light')}
              />
              <ToggleGroupItem
                buttonId={COLOR_SCHEME_DARK}
                isSelected={colorScheme === ColorScheme.DARK}
                onChange={handleColorSchemeChange}
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
            <ToggleGroup aria-labelledby="theme-selector-variant-title" data-test="theme-toggle">
              <ToggleGroupItem
                buttonId={THEME_DEFAULT}
                isSelected={theme === Theme.DEFAULT}
                onChange={handleThemeChange}
                text={t('Default')}
              />
              <ToggleGroupItem
                buttonId={THEME_FELT}
                isSelected={theme === Theme.FELT}
                onChange={handleThemeChange}
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
            <ToggleGroup aria-labelledby="theme-selector-contrast-title" data-test="contrast-mode-toggle">
              <ToggleGroupItem
                buttonId={CONTRAST_MODE_DEFAULT}
                isSelected={contrastMode === ContrastMode.DEFAULT}
                onChange={handleContrastModeChange}
                text={t('Default')}
              />
              <ToggleGroupItem
                buttonId={CONTRAST_MODE_GLASS}
                isSelected={contrastMode === ContrastMode.GLASS}
                onChange={handleContrastModeChange}
                text={t('Glass')}
              />
              <ToggleGroupItem
                buttonId={CONTRAST_MODE_HIGH_CONTRAST}
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

const mapStateToProps = (state: KialiAppState): ReduxProps => {
  return {
    colorScheme: state.globalState.colorScheme,
    contrastMode: state.globalState.contrastMode,
    theme: state.globalState.theme
  };
};

export const ThemeSwitch = connect(mapStateToProps)(ThemeSwitchComponent);

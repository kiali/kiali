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
import { ContrastMode, Theme, ThemeVariant } from 'types/Common';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { useKialiTranslation } from 'utils/I18nUtils';
import { applyDocumentTheme, isFeltTheme, isParentOwnedTheme, persistKialiThemePreferences } from 'utils/ThemeUtils';

type ReduxProps = {
  colorScheme: string;
  contrastMode: string;
  theme: string;
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
  colorScheme: Theme,
  contrastMode: ContrastMode,
  theme: ThemeVariant,
  t: (key: string) => string
): string => {
  const parts = [getThemeDisplayText(colorScheme, t)];

  if (isFeltTheme(theme)) {
    parts.push(t('Project Felt'));
  }

  parts.push(getContrastModeDisplayText(contrastMode, t));

  return `${t('Theme selection')}, ${t('current')}: ${parts.join(', ')}`;
};

export const ThemeSwitchComponent: React.FC<ReduxProps> = (props: ReduxProps) => {
  const { t } = useKialiTranslation();
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  const colorScheme = props.colorScheme as Theme;
  const contrastMode = props.contrastMode as ContrastMode;
  const theme = props.theme as ThemeVariant;

  const applyTheme = (nextColorScheme: Theme, nextContrastMode: ContrastMode, nextTheme: ThemeVariant): void => {
    if (isParentOwnedTheme()) {
      return;
    }

    applyDocumentTheme(nextColorScheme, nextContrastMode, nextTheme);
    store.dispatch(GlobalActions.setColorScheme(nextColorScheme));
    store.dispatch(GlobalActions.setContrastMode(nextContrastMode));
    store.dispatch(GlobalActions.setTheme(nextTheme));
    persistKialiThemePreferences(nextColorScheme, nextContrastMode, nextTheme);
  };

  const handleThemeVariantChange = (event: React.MouseEvent | React.KeyboardEvent | MouseEvent): void => {
    const nextTheme =
      (event.currentTarget as HTMLElement).id === THEME_VARIANT_FELT ? ThemeVariant.FELT : ThemeVariant.DEFAULT;
    applyTheme(colorScheme, contrastMode, nextTheme);
  };

  const handleThemeChange = (event: React.MouseEvent | React.KeyboardEvent | MouseEvent): void => {
    applyTheme((event.currentTarget as HTMLElement).id as Theme, contrastMode, theme);
  };

  const handleContrastModeChange = (event: React.MouseEvent | React.KeyboardEvent | MouseEvent): void => {
    applyTheme(colorScheme, (event.currentTarget as HTMLElement).id as ContrastMode, theme);
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
                isSelected={colorScheme === Theme.LIGHT}
                onChange={handleThemeChange}
                text={t('Light')}
              />
              <ToggleGroupItem
                buttonId={Theme.DARK}
                isSelected={colorScheme === Theme.DARK}
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
            <ToggleGroup aria-labelledby="theme-selector-variant-title" data-test="theme-switch">
              <ToggleGroupItem
                buttonId={THEME_VARIANT_DEFAULT}
                isSelected={theme === ThemeVariant.DEFAULT}
                onChange={handleThemeVariantChange}
                text={t('Default')}
              />
              <ToggleGroupItem
                buttonId={THEME_VARIANT_FELT}
                isSelected={theme === ThemeVariant.FELT}
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

const mapStateToProps = (state: KialiAppState): ReduxProps => {
  return {
    colorScheme: state.globalState.colorScheme,
    contrastMode: state.globalState.contrastMode,
    theme: state.globalState.theme
  };
};

export const ThemeSwitch = connect(mapStateToProps)(ThemeSwitchComponent);

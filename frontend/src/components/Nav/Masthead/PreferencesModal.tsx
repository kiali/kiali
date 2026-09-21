import * as React from 'react';
import {
  Button,
  ButtonVariant,
  Form,
  FormGroup,
  MenuToggle,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Select,
  SelectList,
  SelectOption
} from '@patternfly/react-core';
import type { MenuToggleElement } from '@patternfly/react-core';
import type { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';
import { ColorScheme, ContrastMode, Language, Theme } from 'types/Common';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { serverConfig } from 'config';
import { useKialiTranslation } from 'utils/I18nUtils';
import {
  applyLanguagePreference,
  getDefaultLanguagePreference,
  getLanguageDescription,
  getLanguageLabel,
  isLanguagePreference
} from 'utils/LanguageUtils';
import { kialiStyle } from 'styles/StyleUtils';
import {
  applyDocumentAppearance,
  getKialiColorScheme,
  getKialiContrastMode,
  getKialiTheme,
  isColorScheme,
  isContrastMode,
  persistKialiAppearance
} from 'utils/AppearanceUtils';

type ReduxProps = {
  colorScheme: string;
  contrastMode: string;
  language: string;
  theme: string;
};

type PreferencesModalProps = ReduxProps & {
  isOpen: boolean;
  onClose: () => void;
};

type PreferenceOption<T extends string> = {
  description: string;
  label: string;
  value: T;
};

type PreferenceSelectProps<T extends string> = {
  id: string;
  label: string;
  onChange: (value: T) => void;
  options: PreferenceOption<T>[];
  selected: T;
};

const formStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pf-t--global--spacer--lg)'
});

const introStyle = kialiStyle({
  color: 'var(--pf-t--global--text--color--subtle)',
  margin: 0
});

const selectStyle = kialiStyle({
  width: '100%'
});

/** Delay after a selection before applying appearance changes to the document. */
const PREFERENCE_APPLY_DELAY_MS = 200;

type AppearancePreferences = {
  colorScheme: ColorScheme;
  contrastMode: ContrastMode;
  theme: Theme;
};

const isValidTheme = (theme: string): theme is Theme => {
  return theme === Theme.DEFAULT || theme === Theme.FELT;
};

const PreferenceSelect = <T extends string>({
  id,
  label,
  onChange,
  options,
  selected
}: PreferenceSelectProps<T>): React.ReactElement => {
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  const selectedLabel = options.find(option => option.value === selected)?.label ?? selected;

  const handleSelect = (_event: React.MouseEvent<Element, MouseEvent> | undefined, value?: string | number): void => {
    setIsOpen(false);

    if (value !== undefined && String(value) !== selected) {
      onChange(String(value) as T);
    }
  };

  return (
    <FormGroup fieldId={id} label={label}>
      <Select
        id={id}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSelect={handleSelect}
        selected={selected}
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            aria-label={selectedLabel}
            className={selectStyle}
            data-test={id}
            isExpanded={isOpen}
            onClick={() => setIsOpen(open => !open)}
          >
            {selectedLabel}
          </MenuToggle>
        )}
      >
        <SelectList>
          {options.map(option => (
            <SelectOption
              key={option.value}
              description={option.description}
              isSelected={option.value === selected}
              value={option.value}
            >
              {option.label}
            </SelectOption>
          ))}
        </SelectList>
      </Select>
    </FormGroup>
  );
};

export const PreferencesModalComponent: React.FC<PreferencesModalProps> = ({
  colorScheme: colorSchemeProp,
  contrastMode: contrastModeProp,
  isOpen,
  language: languageProp,
  onClose,
  theme: themeProp
}: PreferencesModalProps) => {
  const { t } = useKialiTranslation();
  const colorScheme = isColorScheme(colorSchemeProp) ? colorSchemeProp : getKialiColorScheme();
  const contrastMode = isContrastMode(contrastModeProp) ? contrastModeProp : getKialiContrastMode();
  const language = isLanguagePreference(languageProp) ? languageProp : getDefaultLanguagePreference();
  const showLanguageSelector = serverConfig.kialiFeatureFlags.uiDefaults?.i18n?.showSelector ?? false;
  const theme = isValidTheme(themeProp) ? themeProp : getKialiTheme();

  const [preferences, setPreferences] = React.useState<AppearancePreferences>({
    colorScheme,
    contrastMode,
    theme
  });
  const preferencesRef = React.useRef<AppearancePreferences>(preferences);
  const applyTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

  const clearApplyTimeout = (): void => {
    if (applyTimeoutRef.current !== undefined) {
      clearTimeout(applyTimeoutRef.current);
      applyTimeoutRef.current = undefined;
    }
  };

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const nextPreferences = { colorScheme, contrastMode, theme };
    preferencesRef.current = nextPreferences;
    setPreferences(nextPreferences);
  }, [colorScheme, contrastMode, theme, isOpen]);

  React.useEffect(() => {
    return () => {
      clearApplyTimeout();
    };
  }, []);

  const applyAppearance = (nextPreferences: AppearancePreferences): void => {
    applyDocumentAppearance(nextPreferences.colorScheme, nextPreferences.contrastMode, nextPreferences.theme);
    store.dispatch(GlobalActions.setColorScheme(nextPreferences.colorScheme));
    store.dispatch(GlobalActions.setContrastMode(nextPreferences.contrastMode));
    store.dispatch(GlobalActions.setTheme(nextPreferences.theme));
    persistKialiAppearance(nextPreferences.colorScheme, nextPreferences.contrastMode, nextPreferences.theme);
  };

  const updatePreference = (update: Partial<AppearancePreferences>): void => {
    const nextPreferences = { ...preferencesRef.current, ...update };
    preferencesRef.current = nextPreferences;
    setPreferences(nextPreferences);
    clearApplyTimeout();
    applyTimeoutRef.current = setTimeout(() => {
      applyTimeoutRef.current = undefined;
      applyAppearance(preferencesRef.current);
    }, PREFERENCE_APPLY_DELAY_MS);
  };

  const handleLanguageChange = (nextLanguage: Language): void => {
    if (nextLanguage !== language) {
      applyLanguagePreference(nextLanguage);
    }
  };

  const languageOptions: PreferenceOption<Language>[] = [
    {
      description: t("Matches your operating system's language setting."),
      label: t('System'),
      value: Language.SYSTEM
    },
    {
      description: getLanguageDescription(Language.ENGLISH),
      label: getLanguageLabel(Language.ENGLISH),
      value: Language.ENGLISH
    },
    {
      description: getLanguageDescription(Language.SPANISH),
      label: getLanguageLabel(Language.SPANISH),
      value: Language.SPANISH
    },
    {
      description: getLanguageDescription(Language.CHINESE),
      label: getLanguageLabel(Language.CHINESE),
      value: Language.CHINESE
    },
    {
      description: getLanguageDescription(Language.KOREAN),
      label: getLanguageLabel(Language.KOREAN),
      value: Language.KOREAN
    }
  ];

  const colorSchemeOptions: PreferenceOption<ColorScheme>[] = [
    {
      description: t("Matches your operating system's color scheme setting."),
      label: t('System'),
      value: ColorScheme.SYSTEM
    },
    {
      description: t('Light colors for the interface.'),
      label: t('Light'),
      value: ColorScheme.LIGHT
    },
    {
      description: t('Dark colors for the interface.'),
      label: t('Dark'),
      value: ColorScheme.DARK
    }
  ];

  const themeOptions: PreferenceOption<Theme>[] = [
    {
      description: t('The default Kiali theme.'),
      label: t('Default'),
      value: Theme.DEFAULT
    },
    {
      description: t('Aligns with the Red Hat Design System using red accents and pill-shaped borders.'),
      label: t('Project Felt'),
      value: Theme.FELT
    }
  ];

  const contrastModeOptions: PreferenceOption<ContrastMode>[] = [
    {
      description: t("Matches your operating system's contrast setting."),
      label: t('System'),
      value: ContrastMode.SYSTEM
    },
    {
      description: t('The default console appearance.'),
      label: t('Default'),
      value: ContrastMode.DEFAULT
    },
    {
      description: t('A modern, visually refreshed console appearance.'),
      label: t('Glass'),
      value: ContrastMode.GLASS
    },
    {
      description: t('Enhances contrast between interface elements for readability.'),
      label: t('High contrast'),
      value: ContrastMode.HIGH_CONTRAST
    }
  ];

  if (!isOpen) {
    return null;
  }

  return (
    <Modal data-test="preferences-modal" isOpen={isOpen} onClose={onClose} variant={ModalVariant.small}>
      <ModalHeader title={t('Preferences')} />
      <ModalBody>
        <Form className={formStyle}>
          <p className={introStyle}>
            {t('Customize how Kiali looks on your device. These settings are saved in your browser.')}
          </p>
          <PreferenceSelect
            id="color-scheme-select"
            label={t('Color scheme')}
            onChange={nextColorScheme => updatePreference({ colorScheme: nextColorScheme })}
            options={colorSchemeOptions}
            selected={preferences.colorScheme}
          />
          <PreferenceSelect
            id="contrast-mode-select"
            label={t('Contrast mode')}
            onChange={nextContrastMode => updatePreference({ contrastMode: nextContrastMode })}
            options={contrastModeOptions}
            selected={preferences.contrastMode}
          />
          <PreferenceSelect
            id="theme-select"
            label={t('Theme')}
            onChange={nextTheme => updatePreference({ theme: nextTheme })}
            options={themeOptions}
            selected={preferences.theme}
          />
          {showLanguageSelector && (
            <PreferenceSelect
              id="language-select"
              label={t('Language')}
              onChange={handleLanguageChange}
              options={languageOptions}
              selected={language}
            />
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button data-test="preferences-close" onClick={onClose} variant={ButtonVariant.primary}>
          {t('Close')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => {
  return {
    colorScheme: state.globalState.colorScheme,
    contrastMode: state.globalState.contrastMode,
    language: state.globalState.language,
    theme: state.globalState.theme
  };
};

export const PreferencesModal = connect(mapStateToProps)(PreferencesModalComponent);

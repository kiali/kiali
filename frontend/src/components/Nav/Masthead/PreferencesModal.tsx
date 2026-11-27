import * as React from 'react';
import {
  Button,
  ButtonVariant,
  Divider,
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
  SelectOption,
  Switch,
  Title,
  Tooltip
} from '@patternfly/react-core';
import type { MenuToggleElement } from '@patternfly/react-core';
import { HelpIcon } from '@patternfly/react-icons';
import type { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';
import { ColorScheme, ContrastMode, Language, Theme } from 'types/Common';
import { GlobalActions } from 'actions/GlobalActions';
import { ChatAIActions } from 'actions/ChatAIActions';
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
  isParentOwnedAppearance,
  persistKialiAppearance
} from 'utils/AppearanceUtils';
import { persistAlwaysNavigatePreference, persistReviewPromptBeforeSendPreference } from 'utils/ChatAIPreferences';

type ReduxProps = {
  alwaysNavigate: boolean;
  chatEnabled: boolean;
  colorScheme: string;
  contrastMode: string;
  language: string;
  reviewPromptBeforeSend: boolean;
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

const sectionTitleStyle = kialiStyle({
  margin: 0
});

const helpButtonStyle = kialiStyle({
  padding: 0
});

const preferenceLabelStyle = kialiStyle({
  alignItems: 'center',
  display: 'inline-flex',
  gap: '0.35rem'
});

/** Delay after a selection before applying appearance changes to the document. */
const PREFERENCE_APPLY_DELAY_MS = 200;

const PreferenceHelpIcon = ({ ariaLabel, content }: { ariaLabel: string; content: string }): React.ReactElement => (
  <Tooltip content={content}>
    <Button
      aria-label={ariaLabel}
      className={helpButtonStyle}
      icon={<HelpIcon />}
      variant={ButtonVariant.plain}
      onClick={event => event.preventDefault()}
    />
  </Tooltip>
);

const PreferenceSwitchLabel = ({
  helpAriaLabel,
  helpContent,
  label
}: {
  helpAriaLabel: string;
  helpContent: string;
  label: string;
}): React.ReactElement => (
  <span className={preferenceLabelStyle}>
    {label}
    <PreferenceHelpIcon ariaLabel={helpAriaLabel} content={helpContent} />
  </span>
);

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
  alwaysNavigate,
  chatEnabled,
  colorScheme: colorSchemeProp,
  contrastMode: contrastModeProp,
  isOpen,
  language: languageProp,
  onClose,
  reviewPromptBeforeSend,
  theme: themeProp
}: PreferencesModalProps) => {
  const { t } = useKialiTranslation();
  const colorScheme = isColorScheme(colorSchemeProp) ? colorSchemeProp : getKialiColorScheme();
  const contrastMode = isContrastMode(contrastModeProp) ? contrastModeProp : getKialiContrastMode();
  const language = isLanguagePreference(languageProp) ? languageProp : getDefaultLanguagePreference();
  const showAppearance = !isParentOwnedAppearance();
  const showLanguageSelector = serverConfig.kialiFeatureFlags.uiDefaults?.i18n?.showSelector ?? true;
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

  const handleAlwaysNavigateChange = (_event: React.FormEvent<HTMLInputElement>, checked: boolean): void => {
    persistAlwaysNavigatePreference(checked);
    store.dispatch(ChatAIActions.setAlwaysNavigate({ alwaysNavigate: checked }));
  };

  const handleReviewPromptBeforeSendChange = (_event: React.FormEvent<HTMLInputElement>, checked: boolean): void => {
    persistReviewPromptBeforeSendPreference(checked);
    store.dispatch(ChatAIActions.setReviewPromptBeforeSend({ reviewPromptBeforeSend: checked }));
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
      description: getLanguageDescription(Language.FRENCH),
      label: getLanguageLabel(Language.FRENCH),
      value: Language.FRENCH
    },
    {
      description: getLanguageDescription(Language.CHINESE),
      label: getLanguageLabel(Language.CHINESE),
      value: Language.CHINESE
    },
    {
      description: getLanguageDescription(Language.JAPANESE),
      label: getLanguageLabel(Language.JAPANESE),
      value: Language.JAPANESE
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
          {showAppearance && (
            <>
              <p className={introStyle}>
                {t('Customize how Kiali looks and reads on your device. These settings are saved in your browser.')}
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
            </>
          )}
          {chatEnabled && (
            <>
              {showAppearance && <Divider />}
              <Title headingLevel="h2" size="md" className={sectionTitleStyle}>
                {t('AI settings')}
              </Title>
              <FormGroup fieldId="preferences-always-navigate">
                <Switch
                  id="preferences-always-navigate"
                  data-test="preferences-always-navigate"
                  label={
                    <PreferenceSwitchLabel
                      label={t('Allow Chatbot to navigate')}
                      helpAriaLabel={t('More information about Allow Chatbot to navigate')}
                      helpContent={t(
                        'When enabled, the chatbot can automatically open Kiali pages it suggests during a conversation. When disabled, those suggestions appear as links you can open yourself.'
                      )}
                    />
                  }
                  isChecked={alwaysNavigate}
                  onChange={handleAlwaysNavigateChange}
                />
              </FormGroup>
              <FormGroup fieldId="preferences-review-prompt-before-send">
                <Switch
                  id="preferences-review-prompt-before-send"
                  data-test="preferences-review-prompt-before-send"
                  label={
                    <PreferenceSwitchLabel
                      label={t('Review prompts before sending')}
                      helpAriaLabel={t('More information about Review prompts before sending')}
                      helpContent={t(
                        'When enabled, prompts started from Kiali pages (such as Troubleshooting) are placed in the chat input so you can edit them before sending. When disabled, those prompts are sent to the chatbot immediately.'
                      )}
                    />
                  }
                  isChecked={reviewPromptBeforeSend}
                  onChange={handleReviewPromptBeforeSendChange}
                />
              </FormGroup>
            </>
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
    alwaysNavigate: state.ai.chat.alwaysNavigate,
    chatEnabled: Boolean(state.ai.enabled && state.ai.chat.enabled),
    colorScheme: state.globalState.colorScheme,
    contrastMode: state.globalState.contrastMode,
    language: state.globalState.language,
    reviewPromptBeforeSend: state.ai.chat.reviewPromptBeforeSend,
    theme: state.globalState.theme
  };
};

export const PreferencesModal = connect(mapStateToProps)(PreferencesModalComponent);

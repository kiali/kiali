import * as React from 'react';
import { MenuToggle, MenuToggleElement, Select, SelectList, SelectOption } from '@patternfly/react-core';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { Language } from 'types/Common';
import { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';
import { i18n } from 'i18n';
import { useKialiTranslation } from 'utils/I18nUtils';

type LanguageSwitchProps = {
  language: string;
};

const getLanguageLabel = (language: Language): string => {
  switch (language) {
    case Language.ENGLISH:
      return 'English';
    case Language.SPANISH:
      return 'Español';
    case Language.CHINESE:
      return '中文';
  }
};

export const LanguageSwitchComponent: React.FC<LanguageSwitchProps> = ({ language }) => {
  const [isOpen, setIsOpen] = React.useState<boolean>(false);

  const { t } = useKialiTranslation();

  const onToggleClick = (): void => {
    setIsOpen(!isOpen);
  };

  const onSelect = (lang: Language): void => {
    if (lang) {
      i18n.changeLanguage(lang).then(() => store.dispatch(GlobalActions.setLanguage(lang)));
    }

    setIsOpen(false);
  };

  return (
    <Select
      id="language-select"
      isOpen={isOpen}
      selected={language}
      onSelect={(_event, value) => onSelect(value as Language)}
      onOpenChange={setIsOpen}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          data-test="switch-language-button"
          onClick={onToggleClick}
          aria-label={t('Switch language')}
          isExpanded={isOpen}
        >
          {getLanguageLabel(language as Language)}
        </MenuToggle>
      )}
    >
      <SelectList>
        <SelectOption value={Language.ENGLISH} isSelected={language === Language.ENGLISH}>
          {getLanguageLabel(Language.ENGLISH)}
        </SelectOption>
        <SelectOption value={Language.SPANISH} isSelected={language === Language.SPANISH}>
          {getLanguageLabel(Language.SPANISH)}
        </SelectOption>
        <SelectOption value={Language.CHINESE} isSelected={language === Language.CHINESE}>
          {getLanguageLabel(Language.CHINESE)}
        </SelectOption>
      </SelectList>
    </Select>
  );
};

const mapStateToProps = (state: KialiAppState): LanguageSwitchProps => {
  return {
    language: state.globalState.language
  };
};

export const LanguageSwitch = connect(mapStateToProps)(LanguageSwitchComponent);

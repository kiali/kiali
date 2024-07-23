import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { Dropdown, DropdownItem, DropdownList, MenuToggle, MenuToggleElement, Tooltip } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { Language } from 'types/Common';
import { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';
import { i18n } from 'i18n';
import { useKialiTranslation } from 'utils/I18nUtils';

const iconStyle = kialiStyle({
  verticalAlign: '-0.25rem',
  $nest: {
    '& svg': {
      width: '1.5rem',
      height: '1.5rem'
    }
  }
});

const checkStyle = kialiStyle({
  marginLeft: '0.5rem'
});

type LanguageSwitchProps = {
  language: string;
};

export const LanguageSwitchComponent: React.FC<LanguageSwitchProps> = ({ language }) => {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState<boolean>(false);

  const { t } = useKialiTranslation();

  const languageItems: React.ReactNode[] = [
    <DropdownItem key="English" onClick={() => switchLanguage(Language.ENGLISH)}>
      <span>English</span>
      {language === Language.ENGLISH && <KialiIcon.Check className={checkStyle} />}
    </DropdownItem>,

    <DropdownItem key="Chinese" onClick={() => switchLanguage(Language.CHINESE)}>
      <span>中文</span>
      {language === Language.CHINESE && <KialiIcon.Check className={checkStyle} />}
    </DropdownItem>
  ];

  const switchLanguage = (language: string): void => {
    i18n.changeLanguage(language).then(() => store.dispatch(GlobalActions.setLanguage(language)));
  };

  const onDropdownSelect = (): void => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <Tooltip position="bottom" content={<>{t('Switch language')}</>} trigger="mouseenter click" exitDelay={0}>
      <Dropdown
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            data-test="switch-language-button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-label={t('Switch language')}
            variant="plain"
            isExpanded={isDropdownOpen}
          >
            <KialiIcon.Language className={iconStyle} />
          </MenuToggle>
        )}
        isOpen={isDropdownOpen}
        popperProps={{ position: 'center' }}
        onOpenChange={(isOpen: boolean) => setIsDropdownOpen(isOpen)}
        onSelect={onDropdownSelect}
      >
        <DropdownList>{languageItems}</DropdownList>
      </Dropdown>
    </Tooltip>
  );
};

const mapStateToProps = (state: KialiAppState): LanguageSwitchProps => {
  return {
    language: state.globalState.language
  };
};

export const LanguageSwitch = connect(mapStateToProps)(LanguageSwitchComponent);

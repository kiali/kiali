import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { Dropdown, DropdownItem, DropdownList, MenuToggle, MenuToggleElement } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import i18n from 'i18next';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { serverConfig } from 'config';
import { Locale } from 'types/Common';
import { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';

const menuToggleStyle = kialiStyle({
  marginTop: '0.25rem',
  verticalAlign: '-0.125rem'
});

const iconStyle = kialiStyle({
  verticalAlign: '-0.375rem',
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
  locale: string;
};

export const LanguageSwitchComponent: React.FC<LanguageSwitchProps> = props => {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState<boolean>(false);

  const supportedLocales = serverConfig.kialiFeatureFlags.uiDefaults.i18n.locales;

  const items: React.ReactNode[] = [];

  if (supportedLocales.includes(Locale.ENGLISH)) {
    items.push(
      <DropdownItem key="English" onClick={() => switchLanguage(Locale.ENGLISH)}>
        <span>English</span>
        {props.locale === Locale.ENGLISH && <KialiIcon.Check className={checkStyle} />}
      </DropdownItem>
    );
  }

  if (supportedLocales.includes(Locale.CHINESE)) {
    items.push(
      <DropdownItem key="Chinese" onClick={() => switchLanguage(Locale.CHINESE)}>
        <span>中文</span>
        {props.locale === Locale.CHINESE && <KialiIcon.Check className={checkStyle} />}
      </DropdownItem>
    );
  }

  const switchLanguage = (locale: string): void => {
    i18n.changeLanguage(locale);
    store.dispatch(GlobalActions.setLocale(locale));
  };

  const onDropdownSelect = (): void => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <div>
      <Dropdown
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            className={menuToggleStyle}
            data-test="switch-language-button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-label="language"
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
        <DropdownList>{items}</DropdownList>
      </Dropdown>
    </div>
  );
};

const mapStateToProps = (state: KialiAppState): LanguageSwitchProps => {
  return {
    locale: state.globalState.locale
  };
};

export const LanguageSwitch = connect(mapStateToProps)(LanguageSwitchComponent);

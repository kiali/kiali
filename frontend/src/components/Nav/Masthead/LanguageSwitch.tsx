import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { Dropdown, DropdownItem, DropdownList, MenuToggle, MenuToggleElement } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import i18n from 'i18next';
import { GlobalActions } from 'actions/GlobalActions';
import { store } from 'store/ConfigStore';
import { serverConfig } from 'config';
import { Locale } from 'types/Common';

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

export const LanguageSwitch: React.FC = () => {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState<boolean>(false);

  const supportedLocales = serverConfig.kialiFeatureFlags.uiDefaults.i18n.locales;

  const items: React.ReactNode[] = [];

  if (supportedLocales.includes(Locale.ENGLISH)) {
    items.push(
      <DropdownItem key="English" onClick={() => switchLanguage(Locale.ENGLISH)}>
        <span>English</span>
      </DropdownItem>
    );
  }

  if (supportedLocales.includes(Locale.CHINESE)) {
    items.push(
      <DropdownItem key="Chinese" onClick={() => switchLanguage(Locale.CHINESE)}>
        <span>中文</span>
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
        popperProps={{ position: 'right' }}
        onOpenChange={(isOpen: boolean) => setIsDropdownOpen(isOpen)}
        onSelect={onDropdownSelect}
      >
        <DropdownList>{items}</DropdownList>
      </Dropdown>
    </div>
  );
};

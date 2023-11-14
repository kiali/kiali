import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { Dropdown, DropdownItem, DropdownList, MenuToggle, MenuToggleElement } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import i18n from 'i18next';

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

export const LanguageSwitch = () => {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState<boolean>(false);

  const items: React.ReactNode[] = [
    <DropdownItem key="English" onClick={() => switchLanguage('en')}>
      <span>English</span>
    </DropdownItem>,
    <DropdownItem key="Chinese" onClick={() => switchLanguage('zh')}>
      <span>中文</span>
    </DropdownItem>
  ];

  const switchLanguage = (languageType: string): void => {
    i18n.changeLanguage(languageType);
    localStorage.setItem('locale', languageType);
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

import React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { Dropdown, DropdownItem, DropdownList, MenuToggle, MenuToggleElement } from '@patternfly/react-core';
import i18n from 'i18next';

const menuToggleStyle = kialiStyle({
  marginTop: '0.25rem',
  verticalAlign: '-0.1rem'
});

const svgStyle = kialiStyle({
  marginTop: '0.25rem',
  verticalAlign: '-0.1rem',
  width: '1rem',
  height: '1rem',
  fill: '#fff'
});

function SwitchLanguage() {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState<boolean>(false);

  const items: JSX.Element[] = [
    <DropdownItem key={'English'} onClick={() => switchLanguage('en')}>
      {'English'}
    </DropdownItem>,
    <DropdownItem key={'Chinese'} onClick={() => switchLanguage('zh')}>
      {'中文'}
    </DropdownItem>
  ];

  const switchLanguage = (languageType: string) => {
    i18n.changeLanguage(languageType);
    localStorage.setItem('locale', languageType);
    window.location.reload();
  };

  const onDropdownSelect = () => {
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 24 24"
              className={svgStyle}
              data-v-c2e55fda=""
            >
              <path d="M0 0h24v24H0z" fill="none"></path>
              <path d=" M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z "></path>
            </svg>
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
}

export { SwitchLanguage };

import * as React from 'react';
import { Flex, FlexItem, Toolbar, ToolbarItem } from '@patternfly/react-core';

import { serverConfig } from '../../../config';
import { RunMode } from '../../../types/ServerConfig';
import { IstioStatus } from '../../IstioStatus/IstioStatus';
import { UserDropdown } from './UserDropdown';
import { HelpDropdown } from './HelpDropdown';
import { MessageCenterTrigger } from '../../../components/MessageCenter/MessageCenterTrigger';
import { ThemeSwitch } from './ThemeSwitch';
import { LanguageSwitch } from './LanguageSwitch';
import { PfSpinner } from 'components/Pf/PfSpinner';
import { kialiStyle } from 'styles/StyleUtils';
import { OfflineStatus } from './OfflineStatus';

export const MASTHEAD = 'masthead';

const toolbarStyle = kialiStyle({
  marginLeft: 'auto',
  $nest: {
    '& .pf-v5-svg': {
      fontSize: '1rem'
    }
  }
});

const istioStatusStyle = kialiStyle({
  marginRight: '2.5rem'
});

const themeSwitchStyle = kialiStyle({
  marginLeft: 0,
  marginRight: '1.5rem'
});

const messageCenterStyle = kialiStyle({
  marginRight: '0.25rem'
});

const helpDropdownStyle = kialiStyle({
  marginRight: '0.5rem'
});

const languageSwitchStyle = kialiStyle({
  marginRight: '0.75rem'
});

const userDropdownStyle = kialiStyle({
  marginLeft: '0.5rem',
  position: 'relative',
  bottom: '0.125rem'
});

const offlineStatusStyle = kialiStyle({
  marginRight: '2.5rem'
});

export const MastheadItems: React.FC = () => {
  return (
    <>
      <PfSpinner />
      <Toolbar>
        <ToolbarItem className={toolbarStyle}>
          <Flex>
            {serverConfig.runMode === RunMode.OFFLINE ? (
              <FlexItem className={offlineStatusStyle}>
                <OfflineStatus />
              </FlexItem>
            ) : (
              <FlexItem className={istioStatusStyle}>
                <IstioStatus location={MASTHEAD} />
              </FlexItem>
            )}

            <FlexItem className={themeSwitchStyle}>
              <ThemeSwitch />
            </FlexItem>

            {serverConfig.kialiFeatureFlags.uiDefaults?.i18n?.showSelector && (
              <FlexItem className={languageSwitchStyle}>
                <LanguageSwitch />
              </FlexItem>
            )}

            <FlexItem className={messageCenterStyle}>
              <MessageCenterTrigger />
            </FlexItem>

            <FlexItem className={helpDropdownStyle}>
              <HelpDropdown />
            </FlexItem>

            <FlexItem data-test="user-dropdown" className={userDropdownStyle}>
              <UserDropdown />
            </FlexItem>
          </Flex>
        </ToolbarItem>
      </Toolbar>
    </>
  );
};

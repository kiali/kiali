import * as React from 'react';
import { Flex, FlexItem } from '@patternfly/react-core';

import { serverConfig } from '../../../config';
import { RunMode } from '../../../types/ServerConfig';
import { IstioStatus } from '../../IstioStatus/IstioStatus';
import { UserDropdown } from './UserDropdown';
import { HelpDropdown } from './HelpDropdown';
import { MessageCenterTrigger } from '../../../components/MessageCenter/MessageCenterTrigger';
import { ThemeSwitch } from './ThemeSwitch';
import { LanguageSwitch } from './LanguageSwitch';
import { PfSpinner } from 'components/Pf/PfSpinner';
import { OfflineStatus } from './OfflineStatus';

export const MastheadItems: React.FC = () => {
  return (
    <Flex style={{ width: '100%' }}>
      {serverConfig.runMode === RunMode.OFFLINE ? (
                <FlexItem>
                  <OfflineStatus />
                </FlexItem>
              ) : (
                <FlexItem>
                  <IstioStatus />
                </FlexItem>
              )}
            <FlexItem><PfSpinner /></FlexItem>
            <FlexItem align={{default: "alignRight" }}>
              <ThemeSwitch />
            </FlexItem>

      {serverConfig.kialiFeatureFlags.uiDefaults?.i18n?.showSelector && (
        <FlexItem>
          <LanguageSwitch />
        </FlexItem>
      )}

      <FlexItem>
        <MessageCenterTrigger />
      </FlexItem>

      <FlexItem>
        <HelpDropdown />
      </FlexItem>

      <FlexItem data-test="user-dropdown">
        <UserDropdown />
      </FlexItem>
    </Flex>
  );
};

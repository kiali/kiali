import * as React from 'react';
import { Toolbar, ToolbarContent, ToolbarGroup, ToolbarItem } from '@patternfly/react-core';

import { kialiStyle } from 'styles/StyleUtils';
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

const centerItemStyle = kialiStyle({
  alignSelf: 'center'
});

export const MastheadItems: React.FC = () => {
  return (
    <Toolbar isFullHeight isStatic>
      <ToolbarContent>
        <ToolbarGroup>
          {serverConfig.runMode === RunMode.OFFLINE ? (
            <ToolbarItem className={centerItemStyle}>
              <OfflineStatus />
            </ToolbarItem>
          ) : (
            <ToolbarItem className={centerItemStyle}>
              <IstioStatus />
            </ToolbarItem>
          )}

          <ToolbarItem className={centerItemStyle}>
            <PfSpinner />
          </ToolbarItem>
        </ToolbarGroup>

        <ToolbarGroup align={{ default: 'alignEnd' }}>
          <ToolbarItem>
            <ThemeSwitch />
          </ToolbarItem>

          <ToolbarItem>
            <MessageCenterTrigger />
          </ToolbarItem>

          <ToolbarItem>
            <HelpDropdown />
          </ToolbarItem>

          {serverConfig.kialiFeatureFlags.uiDefaults?.i18n?.showSelector && (
            <ToolbarItem>
              <LanguageSwitch />
            </ToolbarItem>
          )}

          <ToolbarItem className={centerItemStyle} data-test="user-dropdown">
            <UserDropdown />
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  );
};

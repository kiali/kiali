import * as React from 'react';
import { Label, Flex, FlexItem, Toolbar, ToolbarItem } from '@patternfly/react-core';

import { homeCluster, serverConfig } from '../../../config';
import { IstioStatus } from '../../IstioStatus/IstioStatus';
import { UserDropdown } from './UserDropdown';
import { HelpDropdown } from './HelpDropdown';
import { MessageCenterTrigger } from '../../../components/MessageCenter/MessageCenterTrigger';
import { ThemeSwitch } from './ThemeSwitch';
import { LanguageSwitch } from './LanguageSwitch';
import { KialiIcon } from 'config/KialiIcon';
import { PfSpinner } from 'components/Pf/PfSpinner';
import { isControlPlaneAccessible } from '../../../utils/MeshUtils';
import { kialiStyle } from 'styles/StyleUtils';

export const MASTHEAD = 'masthead';

const toolbarStyle = kialiStyle({
  marginLeft: 'auto',
  $nest: {
    '& .pf-v5-svg': {
      fontSize: '1rem'
    }
  }
});

const themeClusterStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center'
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

export const MastheadItems: React.FC = () => {
  return (
    <>
      <PfSpinner />
      <Toolbar>
        <ToolbarItem className={toolbarStyle}>
          <Flex>
            <FlexItem className={themeClusterStyle}>
              {homeCluster?.name && (
                <Label data-test="cluster-icon" color="blue" icon={<KialiIcon.Cluster />}>
                  {isControlPlaneAccessible() && (
                    <FlexItem className={themeClusterStyle}>
                      <IstioStatus location={MASTHEAD} />
                    </FlexItem>
                  )}
                  {homeCluster?.name}
                </Label>
              )}
            </FlexItem>

            <FlexItem className={themeSwitchStyle}>
              <ThemeSwitch />
            </FlexItem>

            <FlexItem className={messageCenterStyle}>
              <MessageCenterTrigger />
            </FlexItem>

            <FlexItem className={helpDropdownStyle}>
              <HelpDropdown />
            </FlexItem>

            {serverConfig.kialiFeatureFlags.uiDefaults?.i18n?.showSelector && (
              <FlexItem className={languageSwitchStyle}>
                <LanguageSwitch />
              </FlexItem>
            )}

            <FlexItem data-test="user-dropdown" className={userDropdownStyle}>
              <UserDropdown />
            </FlexItem>
          </Flex>
        </ToolbarItem>
      </Toolbar>
    </>
  );
};

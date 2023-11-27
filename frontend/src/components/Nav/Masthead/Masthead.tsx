import * as React from 'react';
import { Label, Flex, FlexItem, Tooltip, Toolbar, ToolbarItem } from '@patternfly/react-core';

import { homeCluster } from '../../../config';
import { MeshMTLSStatus } from '../../../components/MTls/MeshMTLSStatus';
import { IstioStatus } from '../../IstioStatus/IstioStatus';
import { PfSpinner } from '../../PfSpinner';
import { UserDropdown } from './UserDropdown';
import { HelpDropdown } from './HelpDropdown';
import { MessageCenterTrigger } from '../../../components/MessageCenter/MessageCenterTrigger';
import { ThemeSwitch } from './ThemeSwitch';
import { LanguageSwitch } from './LanguageSwitch';
import { KialiIcon } from 'config/KialiIcon';
import { useTranslation } from 'react-i18next';

export const MastheadItems: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      <PfSpinner />
      <Toolbar>
        <ToolbarItem style={{ marginLeft: 'auto' }}>
          <Flex>
            <FlexItem align={{ default: 'alignRight' }}>
              {homeCluster?.name && (
                <Tooltip
                  entryDelay={0}
                  position="bottom"
                  content={
                    <div>
                      {t('nav.home_cluster.tooltip', 'Kiali home cluster: {{name}}', { name: homeCluster?.name })}
                    </div>
                  }
                >
                  <Label data-test="cluster-icon" color="blue" icon={<KialiIcon.Cluster />}>
                    {homeCluster?.name}
                  </Label>
                </Tooltip>
              )}
            </FlexItem>
            <FlexItem style={{ marginLeft: '1rem' }}>
              <ThemeSwitch />
            </FlexItem>
            <FlexItem>
              <IstioStatus cluster={homeCluster?.name} />
            </FlexItem>
            <FlexItem>
              <MeshMTLSStatus />
            </FlexItem>
            <FlexItem style={{ marginRight: 0 }}>
              <MessageCenterTrigger />
            </FlexItem>
            <FlexItem style={{ marginRight: '0.75rem' }}>
              <HelpDropdown />
            </FlexItem>
            <FlexItem>
              <LanguageSwitch />
            </FlexItem>
            <FlexItem>
              <UserDropdown />
            </FlexItem>
          </Flex>
        </ToolbarItem>
      </Toolbar>
    </>
  );
};

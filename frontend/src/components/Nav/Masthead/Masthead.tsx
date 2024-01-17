import * as React from 'react';
import { Label, Flex, FlexItem, Tooltip, Toolbar, ToolbarItem } from '@patternfly/react-core';
import { ClusterIcon } from '@patternfly/react-icons';

import { homeCluster } from '../../../config';
import { MeshMTLSStatus } from '../../../components/MTls/MeshMTLSStatus';
import { IstioStatus } from '../../IstioStatus/IstioStatus';
import { PfSpinner } from '../../PfSpinner';
import { UserDropdown } from './UserDropdown';
import { HelpDropdown } from './HelpDropdown';
import { MessageCenterTrigger } from '../../../components/MessageCenter/MessageCenterTrigger';
import { ThemeSwitch } from 'components/ThemeSwitch/ThemeSwitch';

export class MastheadItems extends React.Component {
  render() {
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
                    content={<div>Kiali home cluster: {homeCluster?.name}</div>}
                  >
                    <Label data-test="cluster-icon" color="blue" icon={<ClusterIcon />}>
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
              <FlexItem>
                <HelpDropdown />
              </FlexItem>
              <FlexItem>
                <UserDropdown />
              </FlexItem>
            </Flex>
          </ToolbarItem>
        </Toolbar>
      </>
    );
  }
}

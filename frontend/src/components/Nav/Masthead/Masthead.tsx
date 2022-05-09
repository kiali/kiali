import * as React from 'react';
import { Label, Flex, FlexItem, Tooltip, Toolbar, ToolbarItem } from '@patternfly/react-core';
import { ClusterIcon } from '@patternfly/react-icons';

import { serverConfig } from '../../../config';
import { default as MeshMTLSStatus } from '../../../components/MTls/MeshMTLSStatus';
import { default as IstioStatus } from '../../IstioStatus/IstioStatus';
import PfSpinner from '../../PfSpinner';
import UserDropdown from './UserDropdown';
import HelpDropdown from './HelpDropdown';
import MessageCenterTriggerContainer from '../../../components/MessageCenter/MessageCenterTrigger';

class MastheadItems extends React.Component {
  render() {
    return (
      <>
        <PfSpinner />
        <Toolbar>
          <ToolbarItem>
            <Flex>
              <FlexItem align={{ default: 'alignRight' }}>
                {!!serverConfig.clusterInfo?.name && (
                  <Tooltip
                    entryDelay={0}
                    position="bottom"
                    content={<div>Kiali home cluster: {serverConfig.clusterInfo.name}</div>}
                  >
                    <Label color="blue" icon={<ClusterIcon />}>
                      {serverConfig.clusterInfo.name}
                    </Label>
                  </Tooltip>
                )}
              </FlexItem>
              <FlexItem>
                <IstioStatus />
              </FlexItem>
              <FlexItem>
                <MeshMTLSStatus />
              </FlexItem>
              <FlexItem style={{ marginRight: 0 }}>
                <MessageCenterTriggerContainer />
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

export default MastheadItems;

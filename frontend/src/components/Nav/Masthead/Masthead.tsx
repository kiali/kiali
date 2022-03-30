import * as React from 'react';
import { style } from 'typestyle';
import { Label, Toolbar, ToolbarGroup, ToolbarItem, Tooltip } from '@patternfly/react-core';
import { ClusterIcon } from '@patternfly/react-icons';

import { serverConfig } from '../../../config';
import { default as MeshMTLSStatus } from '../../../components/MTls/MeshMTLSStatus';
import { default as IstioStatus } from '../../IstioStatus/IstioStatus';
import PfSpinner from '../../PfSpinner';
import UserDropdown from './UserDropdown';
import HelpDropdown from './HelpDropdown';
import MessageCenterTriggerContainer from '../../../components/MessageCenter/MessageCenterTrigger';

const leftGroup = style({
  position: 'absolute',
  left: 210,
  top: 28
});

class Masthead extends React.Component {
  render() {
    return (
      <Toolbar>
        <ToolbarGroup className={leftGroup}>
          <PfSpinner />
        </ToolbarGroup>
        <ToolbarGroup alignment={{ default: 'alignRight' }}>
          {!!serverConfig.clusterInfo?.name && (
            <ToolbarItem>
              <div style={{ paddingRight: '1em' }}>
                <Tooltip
                  entryDelay={0}
                  position="bottom"
                  content={<div>Kiali home cluster: {serverConfig.clusterInfo.name}</div>}
                >
                  <Label>
                    <ClusterIcon /> {serverConfig.clusterInfo.name}
                  </Label>
                </Tooltip>
              </div>
            </ToolbarItem>
          )}
          <ToolbarItem>
            <IstioStatus />
          </ToolbarItem>
          <ToolbarItem>
            <MeshMTLSStatus />
          </ToolbarItem>
          <ToolbarItem>
            <MessageCenterTriggerContainer />
          </ToolbarItem>
          <ToolbarItem>
            <HelpDropdown />
          </ToolbarItem>
          <ToolbarItem>
            <UserDropdown />
          </ToolbarItem>
        </ToolbarGroup>
      </Toolbar>
    );
  }
}

export default Masthead;

import * as React from 'react';

import PfSpinner from '../../PfSpinner';
import { Toolbar as ToolbarNext, ToolbarGroup, ToolbarItem } from '@patternfly/react-core';
import UserDropdown from './UserDropdown';
import { default as MeshMTLSStatus } from '../../../components/MTls/MeshMTLSStatus';
import HelpDropdown from './HelpDropdown';
import MessageCenterTriggerContainer from '../../../components/MessageCenter/MessageCenterTrigger';

class Masthead extends React.Component {
  render() {
    return (
      <ToolbarNext>
        <ToolbarGroup>
          <PfSpinner />
        </ToolbarGroup>
        <ToolbarGroup>
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
      </ToolbarNext>
    );
  }
}

export default Masthead;

import * as React from 'react';

import { Component } from '../../store/Store';
import { OverlayTrigger, Tooltip } from 'patternfly-react';
import { style } from 'typestyle';

const partialIcon = require('../../assets/img/mtls-status-partial.svg');
const fullIcon = require('../../assets/img/mtls-status-full.svg');

type Props = {
  status: { [key: string]: string };
  components: Component[];
  warningMessages: string[];
};

const statusName = 'Istio mTLS';

enum MTLSStatus {
  ENABLED = 'MESH_MTLS_ENABLED',
  PARTIALLY = 'MESH_MTLS_PARTIALLY_ENABLED',
  NOT_ENABLED = 'MESH_MTLS_NOT_ENABLED'
}

type StatusDescriptor = {
  message: string;
  icon: string;
  showStatus: boolean;
};

const emptyDescriptor = {
  message: '',
  icon: '',
  showStatus: false
};

const StatusDescriptors = new Map<string, StatusDescriptor>([
  [
    MTLSStatus.ENABLED,
    {
      message: 'Mesh-wide mTLS is enabled',
      icon: fullIcon,
      showStatus: true
    }
  ],
  [
    MTLSStatus.PARTIALLY,
    {
      message: 'Mesh-wide TLS is partially enabled',
      icon: partialIcon,
      showStatus: true
    }
  ],
  [MTLSStatus.NOT_ENABLED, emptyDescriptor]
]);

class MeshMTLSStatus extends React.Component<Props> {
  statusDescriptor() {
    return StatusDescriptors.get(this.props.status[statusName]) || emptyDescriptor;
  }

  icon() {
    return this.statusDescriptor().icon;
  }

  message() {
    return this.statusDescriptor().message;
  }

  showStatus() {
    return this.statusDescriptor().showStatus;
  }

  iconStyle() {
    return style({
      marginTop: 18,
      marginRight: 8,
      width: 13
    });
  }

  infotipContent() {
    return <Tooltip id={'mtls-status-masthead'}>{this.message()}</Tooltip>;
  }

  render() {
    if (this.showStatus()) {
      return (
        <li className={this.iconStyle()}>
          <OverlayTrigger
            placement={'left'}
            overlay={this.infotipContent()}
            trigger={['hover', 'focus']}
            rootClose={false}
          >
            <img src={this.icon()} alt={this.message()} />
          </OverlayTrigger>
        </li>
      );
    }

    return null;
  }
}

export default MeshMTLSStatus;

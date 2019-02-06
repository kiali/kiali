import * as React from 'react';

import { Component } from '../../store/Store';
import { Icon, Tooltip, OverlayTrigger } from 'patternfly-react';
import { style } from 'typestyle';
import { PfColors } from '../Pf/PfColors';

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
  iconColor: string;
  showStatus: boolean;
};

const emptyDescriptor = {
  message: '',
  icon: '',
  iconColor: '',
  showStatus: false
};

const StatusDescriptors = new Map<string, StatusDescriptor>([
  [
    MTLSStatus.ENABLED,
    {
      message: 'Mesh-wide mTLS is enabled',
      icon: 'locked',
      iconColor: PfColors.Green,
      showStatus: true
    }
  ],
  [
    MTLSStatus.PARTIALLY,
    {
      message: 'Mesh-wide TLS is partially enabled',
      icon: 'unlocked',
      iconColor: PfColors.Orange400,
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

  iconColor() {
    return this.statusDescriptor().iconColor;
  }

  message() {
    return this.statusDescriptor().message;
  }

  showStatus() {
    return this.statusDescriptor().showStatus;
  }

  iconStyle() {
    return style({
      marginTop: 20,
      marginRight: 8,
      color: this.iconColor()
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
            <Icon type="pf" name={this.icon()} />
          </OverlayTrigger>
        </li>
      );
    }

    return null;
  }
}

export default MeshMTLSStatus;

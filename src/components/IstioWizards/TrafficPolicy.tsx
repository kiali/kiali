import * as React from 'react';
import { Col, ControlLabel, DropdownButton, ExpandCollapse, Icon, MenuItem, Row } from 'patternfly-react';
import { style } from 'typestyle';

export const DISABLE = 'DISABLE';
export const ISTIO_MUTUAL = 'ISTIO_MUTUAL';
export const ROUND_ROBIN = 'ROUND_ROBIN';

export const loadBalancerSimple: string[] = [ROUND_ROBIN, 'LEAST_CONN', 'RANDOM', 'PASSTHROUGH'];

export const mTLSMode: string[] = [DISABLE, ISTIO_MUTUAL, 'MUTUAL', 'SIMPLE'];

const statusName = 'Istio mTLS';

enum MTLSStatus {
  ENABLED = 'MESH_MTLS_ENABLED'
}

type Props = {
  status: { [key: string]: string };
  mtlsMode: string;
  loadBalancer: string;
  onTlsChange: (mtlsMode: string) => void;
  onLoadbalancerChange: (loadbalancer: string) => void;
  expanded: boolean;
};

const tlsStyle = style({
  marginTop: 20,
  marginLeft: 20,
  marginRight: 20
});

const lbStyle = style({
  marginLeft: 40,
  marginRight: 20
});

const tlsIconType = 'pf';
const tlsIconName = 'locked';

const expandStyle = style({
  $nest: {
    ['.btn']: {
      fontSize: '14px'
    }
  }
});

class TrafficPolicy extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  componentDidMount(): void {
    const isMtlsEnabled = this.props.status[statusName] && this.props.status[statusName] === MTLSStatus.ENABLED;
    if (isMtlsEnabled) {
      this.props.onTlsChange(ISTIO_MUTUAL);
    }
  }

  render() {
    const tlsMenuItems: any[] = mTLSMode.map(mode => (
      <MenuItem key={mode} eventKey={mode} active={mode === this.props.mtlsMode}>
        {mode}
      </MenuItem>
    ));
    const lbMenuItems: any[] = loadBalancerSimple.map(simple => (
      <MenuItem key={simple} eventKey={simple} active={simple === this.props.loadBalancer}>
        {simple}
      </MenuItem>
    ));
    return (
      <ExpandCollapse
        className={expandStyle}
        textCollapsed="Show Advanced Options"
        textExpanded="Hide Advanced Options"
        expanded={this.props.expanded}
      >
        <Row>
          <Col sm={12}>
            <ControlLabel className={tlsStyle}>
              <Icon type={tlsIconType} name={tlsIconName} /> TLS
            </ControlLabel>
            <DropdownButton
              bsStyle="default"
              title={this.props.mtlsMode}
              id="trafficPolicy-tls"
              onSelect={this.props.onTlsChange}
            >
              {tlsMenuItems}
            </DropdownButton>
            <ControlLabel className={lbStyle}>LoadBalancer</ControlLabel>
            <DropdownButton
              bsStyle="default"
              title={this.props.loadBalancer}
              id="trafficPolicy-lb"
              onSelect={this.props.onLoadbalancerChange}
            >
              {lbMenuItems}
            </DropdownButton>
          </Col>
        </Row>
      </ExpandCollapse>
    );
  }
}

export default TrafficPolicy;

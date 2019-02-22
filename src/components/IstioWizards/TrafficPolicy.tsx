import * as React from 'react';
import { Col, ControlLabel, DropdownButton, MenuItem, Row } from 'patternfly-react';
import { style } from 'typestyle';

export const NONE = 'NONE';

export const ISTIO_MUTUAL = 'ISTIO_MUTUAL';

export const loadBalancerSimple: string[] = [NONE, 'ROUND_ROBIN', 'LEAST_CONN', 'RANDOM', 'PASSTHROUGH'];

export const mTLSMode: string[] = [NONE, ISTIO_MUTUAL, 'MUTUAL', 'SIMPLE', 'DISABLE'];

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
  modified: boolean;
};

const tlsStyle = style({
  marginLeft: 20,
  marginRight: 20
});

const lbStyle = style({
  marginLeft: 40,
  marginRight: 20
});

class TrafficPolicy extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const isMtlsEnabled = this.props.status[statusName] && this.props.status[statusName] === MTLSStatus.ENABLED;
    const mtlsMode = this.props.modified ? this.props.mtlsMode : isMtlsEnabled ? ISTIO_MUTUAL : this.props.mtlsMode;
    const tlsMenuItems: any[] = mTLSMode.map(mode => (
      <MenuItem key={mode} eventKey={mode} active={mode === mtlsMode}>
        {mode}
      </MenuItem>
    ));
    const lbMenuItems: any[] = loadBalancerSimple.map(simple => (
      <MenuItem key={simple} eventKey={simple} active={simple === this.props.loadBalancer}>
        {simple}
      </MenuItem>
    ));
    return (
      <Row>
        <Col sm={12}>
          <ControlLabel className={tlsStyle}>TLS</ControlLabel>
          <DropdownButton bsStyle="default" title={mtlsMode} id="trafficPolicy-tls" onSelect={this.props.onTlsChange}>
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
    );
  }
}

export default TrafficPolicy;

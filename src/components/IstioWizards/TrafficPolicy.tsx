import * as React from 'react';
import { connect } from 'react-redux';
import { Col, ControlLabel, DropdownButton, ExpandCollapse, Icon, MenuItem, Row } from 'patternfly-react';
import { style } from 'typestyle';
import { MTLSStatuses, nsWideMTLSStatus, TLSStatus } from '../../types/TLSStatus';
import { KialiAppState } from '../../store/Store';
import { meshWideMTLSStatusSelector } from '../../store/Selectors';

export const DISABLE = 'DISABLE';
export const ISTIO_MUTUAL = 'ISTIO_MUTUAL';
export const ROUND_ROBIN = 'ROUND_ROBIN';

export const loadBalancerSimple: string[] = [ROUND_ROBIN, 'LEAST_CONN', 'RANDOM', 'PASSTHROUGH'];

export const mTLSMode: string[] = [DISABLE, ISTIO_MUTUAL, 'MUTUAL', 'SIMPLE'];

type ReduxProps = {
  meshWideStatus: string;
};

type Props = ReduxProps & {
  mtlsMode: string;
  loadBalancer: string;
  onTlsChange: (mtlsMode: string) => void;
  onLoadbalancerChange: (loadbalancer: string) => void;
  expanded: boolean;
  nsWideStatus?: TLSStatus;
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
    const meshWideStatus = this.props.meshWideStatus || MTLSStatuses.NOT_ENABLED;
    const nsWideStatus = this.props.nsWideStatus ? this.props.nsWideStatus.status : MTLSStatuses.NOT_ENABLED;
    const isMtlsEnabled = nsWideMTLSStatus(nsWideStatus, meshWideStatus);
    if (isMtlsEnabled === MTLSStatuses.ENABLED) {
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

const mapStateToProps = (state: KialiAppState) => ({
  meshWideStatus: meshWideMTLSStatusSelector(state)
});

const TraffiPolicyContainer = connect(mapStateToProps)(TrafficPolicy);
export default TraffiPolicyContainer;

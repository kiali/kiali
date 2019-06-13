import * as React from 'react';
import {
  Checkbox,
  Col,
  ControlLabel,
  DropdownButton,
  Form,
  FormControl,
  FormGroup,
  HelpBlock,
  MenuItem,
  Radio,
  Switch
} from 'patternfly-react';
import { style } from 'typestyle';

type Props = {
  serviceName: string;
  hasGateway: boolean;
  gateway: string;
  isMesh: boolean;
  gateways: string[];
  onGatewayChange: (valid: boolean, gateway: GatewaySelectorState) => void;
};

export type GatewaySelectorState = {
  addGateway: boolean;
  gwHosts: string;
  gwHostsValid: boolean;
  newGateway: boolean;
  selectedGateway: string;
  addMesh: boolean;
  port: number;
};

enum GatewayForm {
  SWITCH,
  MESH,
  GW_HOSTS,
  SELECT,
  GATEWAY_SELECTED,
  PORT
}

const labelStyle = style({
  marginTop: 20
});

class GatewaySelector extends React.Component<Props, GatewaySelectorState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      addGateway: props.hasGateway,
      gwHosts: '*',
      gwHostsValid: true,
      newGateway: props.gateways.length === 0,
      selectedGateway: props.gateways.length > 0 ? (props.gateway !== '' ? props.gateway : props.gateways[0]) : '',
      addMesh: props.isMesh,
      port: 80
    };
  }

  checkGwHosts = (gwHosts: string): boolean => {
    const hosts = gwHosts.split(',');
    for (let i = 0; i < hosts.length; i++) {
      if (hosts[i] === '*') {
        continue;
      }
      if (!hosts[i].includes('.')) {
        return false;
      }
    }
    return true;
  };

  onFormChange = (component: GatewayForm, value: string) => {
    switch (component) {
      case GatewayForm.SWITCH:
        this.setState(
          prevState => {
            return {
              addGateway: !prevState.addGateway
            };
          },
          () => this.props.onGatewayChange(true, this.state)
        );
        break;
      case GatewayForm.MESH:
        this.setState(
          prevState => {
            return {
              addMesh: !prevState.addMesh
            };
          },
          () => this.props.onGatewayChange(true, this.state)
        );
        break;
      case GatewayForm.GW_HOSTS:
        this.setState(
          {
            gwHosts: value,
            gwHostsValid: this.checkGwHosts(value)
          },
          () => this.props.onGatewayChange(this.state.gwHostsValid, this.state)
        );
        break;
      case GatewayForm.SELECT:
        this.setState(
          {
            newGateway: value === 'true'
          },
          () => this.props.onGatewayChange(true, this.state)
        );
        break;
      case GatewayForm.GATEWAY_SELECTED:
        this.setState(
          {
            selectedGateway: value
          },
          () => this.props.onGatewayChange(true, this.state)
        );
        break;
      case GatewayForm.PORT:
        this.setState(
          {
            port: +value
          },
          () => this.props.onGatewayChange(true, this.state)
        );
        break;
      default:
      // No default action
    }
  };

  render() {
    const gatewayItems: any[] = this.props.gateways.map(gw => (
      <MenuItem key={gw} eventKey={gw} active={gw === this.state.selectedGateway}>
        {gw}
      </MenuItem>
    ));
    return (
      <Form horizontal={true} onSubmit={e => e.preventDefault()}>
        <FormGroup controlId="gatewaySwitch" disabled={false}>
          <Col componentClass={ControlLabel} sm={3}>
            Add Gateway
          </Col>
          <Col sm={9}>
            <Switch
              bsSize="normal"
              title="normal"
              id="gateway-form"
              animate={false}
              onChange={() => this.onFormChange(GatewayForm.SWITCH, '')}
              defaultValue={this.props.hasGateway}
            />
          </Col>
        </FormGroup>
        {this.state.addGateway && (
          <>
            <FormGroup controlId="checkbox" disabled={false}>
              <Col sm={3} />
              <Col sm={9}>
                <Checkbox
                  disabled={!this.state.addGateway}
                  checked={this.state.addMesh}
                  onChange={() => this.onFormChange(GatewayForm.MESH, '')}
                >
                  Include <b>mesh</b> gateway
                </Checkbox>
              </Col>
            </FormGroup>
            <FormGroup>
              <Col sm={3} />
              <Col sm={9}>
                <Radio
                  name="selectGateway"
                  className={labelStyle}
                  disabled={!this.state.addGateway || this.props.gateways.length === 0}
                  checked={!this.state.newGateway}
                  onChange={() => this.onFormChange(GatewayForm.SELECT, 'false')}
                  inline={true}
                >
                  Select Gateway
                </Radio>
                <Radio
                  name="selectGateway"
                  className={labelStyle}
                  disabled={!this.state.addGateway}
                  checked={this.state.newGateway}
                  onChange={() => this.onFormChange(GatewayForm.SELECT, 'true')}
                  inline={true}
                >
                  Create Gateway
                </Radio>
              </Col>
            </FormGroup>
            {!this.state.newGateway && (
              <FormGroup>
                <Col componentClass={ControlLabel} sm={3}>
                  Gateway
                </Col>
                <Col sm={9}>
                  {this.props.gateways.length > 0 && (
                    <DropdownButton
                      id="trafficPolicy-tls"
                      bsStyle="default"
                      title={this.state.selectedGateway}
                      disabled={!this.state.addGateway || this.state.newGateway || this.props.gateways.length === 0}
                      onSelect={(gw: string) => this.onFormChange(GatewayForm.GATEWAY_SELECTED, gw)}
                    >
                      {gatewayItems}
                    </DropdownButton>
                  )}
                  {this.props.gateways.length === 0 && <HelpBlock>There are no gateways to select.</HelpBlock>}
                </Col>
              </FormGroup>
            )}
            {this.state.newGateway && (
              <>
                <FormGroup>
                  <Col componentClass={ControlLabel} sm={3}>
                    Port
                  </Col>
                  <Col sm={9}>
                    <FormControl
                      type="number"
                      disabled={!this.state.addGateway || !this.state.newGateway}
                      value={this.state.port}
                      onChange={e => this.onFormChange(GatewayForm.PORT, e.target.value)}
                    />
                  </Col>
                </FormGroup>
                <FormGroup
                  controlId="gwHosts"
                  disabled={!this.state.addGateway}
                  validationState={this.state.gwHostsValid ? null : 'error'}
                >
                  <Col componentClass={ControlLabel} sm={3}>
                    Gateway Hosts
                  </Col>
                  <Col sm={9}>
                    <FormControl
                      type="text"
                      disabled={!this.state.addGateway || !this.state.newGateway}
                      value={this.state.gwHosts}
                      onChange={e => this.onFormChange(GatewayForm.GW_HOSTS, e.target.value)}
                    />
                    <HelpBlock>
                      One or more hosts exposed by this gateway. Enter one or multiple hosts separated by comma.
                      {!this.state.gwHostsValid && (
                        <p>Gateway hosts should be specified using FQDN format or '*' wildcard.</p>
                      )}
                    </HelpBlock>
                  </Col>
                </FormGroup>
              </>
            )}
          </>
        )}
      </Form>
    );
  }
}

export default GatewaySelector;

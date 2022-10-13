import * as React from 'react';
import {
  Checkbox,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Radio,
  Switch,
  TextInput
} from '@patternfly/react-core';
import { serverConfig } from '../../config';
import { GATEWAY_TOOLTIP, wizardTooltip } from './WizardHelp';
import { isValid } from 'utils/Common';

type Props = {
  serviceName: string;
  hasGateway: boolean;
  hasK8sGateway: boolean;
  gateway: string;
  k8sGateway: string;
  isMesh: boolean;
  gateways: string[];
  k8sGateways: string[];
  vsHosts: string[];
  k8sRouteHosts: string[];
  onGatewayChange: (valid: boolean, gateway: GatewaySelectorState) => void;
  onK8sGatewayChange: (valid: boolean, k8sGateway: GatewaySelectorState) => void;
};

export type GatewaySelectorState = {
  addGateway: boolean;
  selectGateway: boolean;
  selectK8sGateway: boolean;
  gwHosts: string;
  gwHostsValid: boolean;
  newGateway: boolean;
  newK8sGateway: boolean;
  selectedGateway: string;
  selectedK8sGateway: string;
  addMesh: boolean;
  port: number;
};

enum GatewayForm {
  SWITCH,
  MESH,
  GW_HOSTS,
  SELECT,
  GATEWAY_SELECTED,
  PORT,
  SELECT_K8S,
  NEW_GW,
  NEW_K8S_GW,
  K8S_GATEWAY_SELECTED,
}

class GatewaySelector extends React.Component<Props, GatewaySelectorState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      addGateway: props.hasGateway,
      selectGateway: props.gateways.length !== 0,
      selectK8sGateway: props.k8sGateways.length !== 0 && props.gateways.length === 0,
      gwHosts: '*',
      gwHostsValid: true,
      newGateway: props.gateways.length === 0,
      newK8sGateway: props.k8sGateways.length === 0 && props.gateways.length !== 0,
      selectedGateway: props.gateways.length > 0 ? (props.gateway !== '' ? props.gateway : props.gateways[0]) : '',
      selectedK8sGateway: props.k8sGateways.length > 0 ? (props.k8sGateway !== '' ? props.k8sGateway : props.k8sGateways[0]) : '',
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
          () => this.props.onGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case GatewayForm.MESH:
        this.setState(
          prevState => {
            return {
              addMesh: !prevState.addMesh
            };
          },
          () => this.props.onGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case GatewayForm.GW_HOSTS:
        this.setState(
          {
            gwHosts: value,
            gwHostsValid: this.checkGwHosts(value)
          },
          () => this.props.onGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case GatewayForm.SELECT:
        this.setState(
          {
            newGateway: false,
            newK8sGateway: false,
            selectGateway: true,
            selectK8sGateway: false,
          },
          () => this.props.onGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case GatewayForm.SELECT_K8S:
        this.setState(
          {
            newGateway: false,
            newK8sGateway: false,
            selectGateway: false,
            selectK8sGateway: true,
          },
          () => this.props.onK8sGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case GatewayForm.NEW_GW:
        this.setState(
          {
            newGateway: true,
            newK8sGateway: false,
            selectGateway: false,
            selectK8sGateway: false,
          },
          () => this.props.onK8sGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case GatewayForm.NEW_K8S_GW:
        this.setState(
          {
            newGateway: false,
            newK8sGateway: true,
            selectGateway: false,
            selectK8sGateway: false,
          },
          () => this.props.onK8sGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case GatewayForm.GATEWAY_SELECTED:
        this.setState(
          {
            selectedGateway: value
          },
          () => this.props.onGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case GatewayForm.K8S_GATEWAY_SELECTED:
        this.setState(
          {
            selectedK8sGateway: value
          },
          () => this.props.onK8sGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case GatewayForm.PORT:
        this.setState(
          {
            port: +value
          },
          () => this.props.onGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      default:
      // No default action
    }
  };

  isMeshGatewayValid = (): boolean => {
    const hasVsWildcard = this.props.vsHosts.some(h => h === '*');
    const hasGwWildcard = this.state.gwHosts.split(',').some(h => h === '*');
    // Gateway added
    if (this.state.addGateway) {
      // Mesh can't use wildcard in the hosts
      // @TODO Mesh for K8s Gateway is under development
      if (this.state.addMesh) {
        if (this.state.newGateway) {
          // If mesh, a new gateway can't use wildcard
          return !hasGwWildcard;
        } else {
          // If mesh, a selected gateway can't use wildcard
          if (this.state.selectGateway) {
            return !hasVsWildcard;
          }
        }
      }
      return true;
    } else {
      // No gateway means that mesh is used by default
      // Mesh can't use wildcard in the hosts
      return !hasVsWildcard;
    }
  };

  isGatewayValid = (): boolean => {
    // gwHostsValid is used as last validation, it's true by default
    return this.isMeshGatewayValid() && this.state.gwHostsValid;
  };

  render() {
    return (
      <Form isHorizontal={true}>
        <FormGroup label="Add Gateway" fieldId="gatewaySwitch">
          <Switch
            id="advanced-gwSwitch"
            label={' '}
            labelOff={' '}
            isChecked={this.state.addGateway}
            onChange={() => this.onFormChange(GatewayForm.SWITCH, '')}
          />
          <span>{wizardTooltip(GATEWAY_TOOLTIP)}</span>
        </FormGroup>
        {this.state.addGateway && (
          <>
            <FormGroup fieldId="selectGateway">
              <Radio
                id="existingGateway"
                name="selectGateway"
                label="Select Gateway"
                isDisabled={!this.state.addGateway || this.props.gateways.length === 0}
                isChecked={this.state.selectGateway}
                onChange={() => this.onFormChange(GatewayForm.SELECT, '')}
              />
              {serverConfig.gatewayAPIEnabled && (
                <Radio
                  id="existingK8sGateway"
                  name="selectGateway"
                  label="Select K8s API Gateway"
                  isDisabled={!this.state.addGateway || this.props.k8sGateways.length === 0}
                  isChecked={this.state.selectK8sGateway}
                  onChange={() => this.onFormChange(GatewayForm.SELECT_K8S, '')}
                />
              )}
              <Radio
                id="createGateway"
                name="selectGateway"
                label="Create Gateway"
                isDisabled={!this.state.addGateway}
                isChecked={this.state.newGateway}
                onChange={() => this.onFormChange(GatewayForm.NEW_GW, '')}
              />
              {serverConfig.gatewayAPIEnabled && (
                <Radio
                  id="createK8sGateway"
                  name="selectGateway"
                  label="Create K8s API Gateway"
                  isDisabled={!this.state.addGateway}
                  isChecked={this.state.newK8sGateway}
                  onChange={() => this.onFormChange(GatewayForm.NEW_K8S_GW, '')}
                />
              )}
            </FormGroup>
            {(this.state.newGateway || this.state.selectGateway) && (
              <FormGroup
                fieldId="includeMesh"
                validated={isValid(this.isMeshGatewayValid())}
                helperTextInvalid={"VirtualService Host '*' wildcard not allowed on mesh gateway."}
              >
                <Checkbox
                  id="includeMesh"
                  label={
                    <>
                      Include <b>mesh</b> gateway
                    </>
                  }
                  isDisabled={!this.state.addGateway}
                  isChecked={this.state.addMesh}
                  onChange={() => this.onFormChange(GatewayForm.MESH, '')}
                />
              </FormGroup>
            )}
            {this.state.addGateway && this.state.selectGateway && (
              <FormGroup fieldId="selectGateway" label="Gateway">
                {this.props.gateways.length > 0 && (
                  <FormSelect
                    id="selectGateway"
                    value={this.state.selectedGateway}
                    isDisabled={this.props.gateways.length === 0}
                    onChange={(gw: string) => this.onFormChange(GatewayForm.GATEWAY_SELECTED, gw)}
                  >
                    {this.props.gateways.map(gw => (
                      <FormSelectOption key={gw} value={gw} label={gw} />
                    ))}
                  </FormSelect>
                )}
                {this.props.gateways.length === 0 && <>There are no gateways to select.</>}
              </FormGroup>
            )}
            {this.state.addGateway && this.state.selectK8sGateway && (
              <FormGroup fieldId="selectK8sGateway" label="K8s Gateway">
                {this.props.k8sGateways.length > 0 && (
                  <FormSelect
                    id="selectK8sGateway"
                    value={this.state.selectedK8sGateway}
                    isDisabled={this.props.k8sGateways.length === 0}
                    onChange={(gw: string) => this.onFormChange(GatewayForm.K8S_GATEWAY_SELECTED, gw)}
                  >
                    {this.props.k8sGateways.map(gw => (
                      <FormSelectOption key={gw} value={gw} label={gw} />
                    ))}
                  </FormSelect>
                )}
                {this.props.gateways.length === 0 && <>There are no K8s API gateways to select.</>}
              </FormGroup>
            )}
            {(this.state.newGateway || this.state.newK8sGateway) && (
              <>
                <FormGroup fieldId="gwPort" label="Port">
                  <TextInput
                    id="gwPort"
                    name="gwPort"
                    type="number"
                    isDisabled={!this.state.addGateway || (!this.state.newK8sGateway && !this.state.newGateway)}
                    value={this.state.port}
                    onChange={value => this.onFormChange(GatewayForm.PORT, value)}
                  />
                </FormGroup>
                {this.state.newGateway && (
                  <FormGroup
                    fieldId="gwHosts"
                    label="Gateway Hosts"
                    helperText="One or more hosts exposed by this gateway. Enter one or multiple hosts separated by comma."
                    helperTextInvalid="Gateway hosts should be specified using FQDN format or '*' wildcard."
                    validated={isValid(this.state.gwHostsValid)}
                  >
                    <TextInput
                      id="gwHosts"
                      name="gwHosts"
                      isDisabled={!this.state.addGateway || (!this.state.newK8sGateway && !this.state.newGateway)}
                      value={this.state.gwHosts}
                      onChange={value => this.onFormChange(GatewayForm.GW_HOSTS, value)}
                      validated={isValid(this.state.gwHostsValid)}
                    />
                  </FormGroup>
                )}
                {this.state.newK8sGateway && (
                  <FormGroup
                    fieldId="gwHosts"
                    label="K8s API Gateway Host"
                    helperText="One host exposed by this gateway."
                    helperTextInvalid="K8s API Gateway host should be specified using FQDN format or '*' wildcard."
                    validated={isValid(this.state.gwHostsValid)}
                  >
                    <TextInput
                      id="gwHosts"
                      name="gwHosts"
                      isDisabled={!this.state.addGateway || (!this.state.newK8sGateway && !this.state.newGateway)}
                      value={this.state.gwHosts}
                      onChange={value => this.onFormChange(GatewayForm.GW_HOSTS, value)}
                      validated={isValid(this.state.gwHostsValid)}
                    />
                  </FormGroup>
                )}
              </>
            )}
          </>
        )}
      </Form>
    );
  }
}

export default GatewaySelector;

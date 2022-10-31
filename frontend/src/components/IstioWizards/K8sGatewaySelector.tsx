import * as React from 'react';
import {
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Radio,
  Switch,
  TextInput
} from '@patternfly/react-core';
import { GATEWAY_TOOLTIP, wizardTooltip } from './WizardHelp';
import { isValid } from 'utils/Common';

type Props = {
  serviceName: string;
  hasGateway: boolean;
  gateway: string;
  k8sGateways: string[];
  k8sRouteHosts: string[];
  onGatewayChange: (valid: boolean, gateway: K8sGatewaySelectorState) => void;
};

export type K8sGatewaySelectorState = {
  addGateway: boolean;
  gwHosts: string;
  gwHostsValid: boolean;
  newGateway: boolean;
  selectedGateway: string;
  // @TODO add Mesh is not supported yet
  addMesh: boolean;
  port: number;
};

enum K8sGatewayForm {
  SWITCH,
  GW_HOSTS,
  SELECT,
  GATEWAY_SELECTED,
  PORT
}

class K8sGatewaySelector extends React.Component<Props, K8sGatewaySelectorState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      addGateway: props.hasGateway,
      gwHosts: props.k8sRouteHosts.join(','),
      gwHostsValid: true,
      newGateway: props.k8sGateways.length === 0,
      selectedGateway: props.k8sGateways.length > 0 ? (props.gateway !== '' ? props.gateway : props.k8sGateways[0]) : '',
      addMesh: false,
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

  onFormChange = (component: K8sGatewayForm, value: string) => {
    switch (component) {
      case K8sGatewayForm.SWITCH:
        this.setState(
          prevState => {
            return {
              addGateway: !prevState.addGateway
            };
          },
          () => this.props.onGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case K8sGatewayForm.GW_HOSTS:
        this.setState(
          {
            gwHosts: value,
            gwHostsValid: this.checkGwHosts(value)
          },
          () => this.props.onGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case K8sGatewayForm.SELECT:
        this.setState(
          {
            newGateway: value === 'true'
          },
          () => this.props.onGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case K8sGatewayForm.GATEWAY_SELECTED:
        this.setState(
          {
            selectedGateway: value
          },
          () => this.props.onGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case K8sGatewayForm.PORT:
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

  isGatewayValid = (): boolean => {
    // gwHostsValid is used as last validation, it's true by default
    return this.state.gwHostsValid;
  };

  render() {
    return (
      <Form isHorizontal={true}>
        <FormGroup label="Add K8s API Gateway" fieldId="gatewaySwitch">
          <Switch
            id="advanced-gwSwitch"
            label={' '}
            labelOff={' '}
            isChecked={this.state.addGateway}
            onChange={() => this.onFormChange(K8sGatewayForm.SWITCH, '')}
          />
          <span>{wizardTooltip(GATEWAY_TOOLTIP)}</span>
        </FormGroup>
        {this.state.addGateway && (
          <>
            <FormGroup fieldId="selectGateway">
              <Radio
                id="existingGateway"
                name="selectGateway"
                label="Select K8s API Gateway"
                isDisabled={!this.state.addGateway || this.props.k8sGateways.length === 0}
                isChecked={!this.state.newGateway}
                onChange={() => this.onFormChange(K8sGatewayForm.SELECT, 'false')}
              />
              <Radio
                id="createGateway"
                name="selectGateway"
                label="Create K8s API Gateway"
                isDisabled={!this.state.addGateway}
                isChecked={this.state.newGateway}
                onChange={() => this.onFormChange(K8sGatewayForm.SELECT, 'true')}
              />
            </FormGroup>
            {!this.state.newGateway && (
              <FormGroup fieldId="selectGateway" label="K8sGateway">
                {this.props.k8sGateways.length > 0 && (
                  <FormSelect
                    id="selectGateway"
                    value={this.state.selectedGateway}
                    isDisabled={!this.state.addGateway || this.state.newGateway || this.props.k8sGateways.length === 0}
                    onChange={(k8sGateway: string) => this.onFormChange(K8sGatewayForm.GATEWAY_SELECTED, k8sGateway)}
                  >
                    {this.props.k8sGateways.map(k8sGateway => (
                      <FormSelectOption key={k8sGateway} value={k8sGateway} label={k8sGateway} />
                    ))}
                  </FormSelect>
                )}
                {this.props.k8sGateways.length === 0 && <>There are no K8s API gateways to select.</>}
              </FormGroup>
            )}
            {this.state.newGateway && (
              <>
                <FormGroup fieldId="gwPort" label="Port">
                  <TextInput
                    id="gwPort"
                    name="gwPort"
                    type="number"
                    isDisabled={!this.state.addGateway || !this.state.newGateway}
                    value={this.state.port}
                    onChange={value => this.onFormChange(K8sGatewayForm.PORT, value)}
                  />
                </FormGroup>
                <FormGroup
                  fieldId="gwHosts"
                  label="K8s API Gateway Hosts"
                  helperText="One or more hosts exposed by this gateway. Enter one or multiple hosts separated by comma."
                  helperTextInvalid="K8s API Gateway hosts should be specified using FQDN format or '*.' format."
                  validated={isValid(this.state.gwHostsValid)}
                >
                  <TextInput
                    id="gwHosts"
                    name="gwHosts"
                    isDisabled={!this.state.addGateway || !this.state.newGateway}
                    value={this.state.gwHosts}
                    onChange={value => this.onFormChange(K8sGatewayForm.GW_HOSTS, value)}
                    validated={isValid(this.state.gwHostsValid)}
                  />
                </FormGroup>
              </>
            )}
          </>
        )}
      </Form>
    );
  }
}

export default K8sGatewaySelector;

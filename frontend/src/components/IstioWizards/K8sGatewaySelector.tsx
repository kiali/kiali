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
  hasK8sGateway: boolean;
  k8sGateway: string;
  isMesh: boolean;
  gateways: string[];
  k8sGateways: string[];
  k8sRouteHosts: string[];
  onK8sGatewayChange: (valid: boolean, k8sGateway:K8sGatewaySelectorState) => void;
};

export type K8sGatewaySelectorState = {
  addGateway: boolean;
  selectK8sGateway: boolean;
  gwHosts: string;
  gwHostsValid: boolean;
  newK8sGateway: boolean;
  selectedK8sGateway: string;
  port: number;
};

enum K8sGatewayForm {
  SWITCH,
  GW_HOSTS,
  PORT,
  SELECT_K8S,
  NEW_GW,
  NEW_K8S_GW,
  K8S_GATEWAY_SELECTED,
}

class K8sGatewaySelector extends React.Component<Props, K8sGatewaySelectorState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      addGateway: props.hasK8sGateway,
      selectK8sGateway: props.k8sGateways.length !== 0 && props.gateways.length === 0,
      gwHosts: '*',
      gwHostsValid: true,
      newK8sGateway: props.k8sGateways.length === 0 && props.gateways.length !== 0,
      selectedK8sGateway: props.k8sGateways.length > 0 ? (props.k8sGateway !== '' ? props.k8sGateway : props.k8sGateways[0]) : '',
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
          () => this.props.onK8sGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case K8sGatewayForm.GW_HOSTS:
        this.setState(
          {
            gwHosts: value,
            gwHostsValid: this.checkGwHosts(value)
          },
          () => this.props.onK8sGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case K8sGatewayForm.SELECT_K8S:
        this.setState(
          {
            newK8sGateway: false,
            selectK8sGateway: true,
          },
          () => this.props.onK8sGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case K8sGatewayForm.NEW_GW:
        this.setState(
          {
            newK8sGateway: false,
            selectK8sGateway: false,
          },
          () => this.props.onK8sGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case K8sGatewayForm.NEW_K8S_GW:
        this.setState(
          {
            newK8sGateway: true,
            selectK8sGateway: false,
          },
          () => this.props.onK8sGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case K8sGatewayForm.K8S_GATEWAY_SELECTED:
        this.setState(
          {
            selectedK8sGateway: value
          },
          () => this.props.onK8sGatewayChange(this.isGatewayValid(), this.state)
        );
        break;
      case K8sGatewayForm.PORT:
        this.setState(
          {
            port: +value
          },
          () => this.props.onK8sGatewayChange(this.isGatewayValid(), this.state)
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
        <FormGroup label="Add Gateway" fieldId="gatewaySwitch">
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
                id="existingK8sGateway"
                name="selectGateway"
                label="Select K8s API Gateway"
                isDisabled={!this.state.addGateway || this.props.k8sGateways.length === 0}
                isChecked={this.state.selectK8sGateway}
                onChange={() => this.onFormChange(K8sGatewayForm.SELECT_K8S, '')}
              />
              <Radio
                id="createK8sGateway"
                name="selectGateway"
                label="Create K8s API Gateway"
                isDisabled={!this.state.addGateway}
                isChecked={this.state.newK8sGateway}
                onChange={() => this.onFormChange(K8sGatewayForm.NEW_K8S_GW, '')}
              />
            </FormGroup>
            {this.state.addGateway && this.state.selectK8sGateway && (
              <FormGroup fieldId="selectK8sGateway" label="K8s Gateway">
                {this.props.k8sGateways.length > 0 && (
                  <FormSelect
                    id="selectK8sGateway"
                    value={this.state.selectedK8sGateway}
                    isDisabled={this.props.k8sGateways.length === 0}
                    onChange={(gw: string) => this.onFormChange(K8sGatewayForm.K8S_GATEWAY_SELECTED, gw)}
                  >
                    {this.props.k8sGateways.map(gw => (
                      <FormSelectOption key={gw} value={gw} label={gw} />
                    ))}
                  </FormSelect>
                )}
                {this.props.gateways.length === 0 && <>There are no K8s API gateways to select.</>}
              </FormGroup>
            )}
            {this.state.newK8sGateway && (
              <>
                <FormGroup fieldId="gwPort" label="Port">
                  <TextInput
                    id="gwPort"
                    name="gwPort"
                    type="number"
                    isDisabled={!this.state.addGateway || !this.state.newK8sGateway}
                    value={this.state.port}
                    onChange={value => this.onFormChange(K8sGatewayForm.PORT, value)}
                  />
                </FormGroup>
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
                      isDisabled={!this.state.addGateway || !this.state.newK8sGateway}
                      value={this.state.gwHosts}
                      onChange={value => this.onFormChange(K8sGatewayForm.GW_HOSTS, value)}
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

export default K8sGatewaySelector;

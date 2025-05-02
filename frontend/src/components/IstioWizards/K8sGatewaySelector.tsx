import * as React from 'react';
import {
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  MenuToggle,
  Radio,
  Select,
  SelectList,
  SelectOption,
  Switch,
  TextInput
} from '@patternfly/react-core';
import { GATEWAY_TOOLTIP, wizardTooltip } from './WizardHelp';
import { isValid } from 'utils/Common';
import { isK8sGatewayHostValid } from '../../utils/IstioConfigUtils';
import { serverConfig } from '../../config';

type Props = {
  gateway: string;
  hasGateway: boolean;
  k8sGateways: string[];
  k8sRouteHosts: string[];
  onGatewayChange: (valid: boolean, gateway: K8sGatewaySelectorState) => void;
  serviceName: string;
};

export type K8sGatewaySelectorState = {
  addGateway: boolean;
  // @TODO add Mesh is not supported yet
  addMesh: boolean;
  gatewayClass: string;
  gwHosts: string;
  gwHostsValid: boolean;
  isOpen: boolean;
  newGateway: boolean;
  port: number;
  selectedGateway: string;
};

enum K8sGatewayForm {
  SWITCH,
  GW_HOSTS,
  SELECT,
  GATEWAY_SELECTED,
  PORT
}

export class K8sGatewaySelector extends React.Component<Props, K8sGatewaySelectorState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      addGateway: props.hasGateway,
      gwHosts: props.k8sRouteHosts.join(','),
      gwHostsValid: true,
      newGateway: props.k8sGateways.length === 0,
      selectedGateway:
        props.k8sGateways.length > 0 ? (props.gateway !== '' ? props.gateway : props.k8sGateways[0]) : '',
      gatewayClass: serverConfig?.gatewayAPIClasses?.length > 0 ? serverConfig.gatewayAPIClasses[0].className : '',
      addMesh: false,
      port: 80,
      isOpen: false
    };
  }

  onToggleClick = (): void => {
    this.setState(prevState => ({ isOpen: !prevState.isOpen }));
  };

  toggleMenu = (toggleRef: React.Ref<any>, label: string, isDisabled = false): React.ReactNode => (
    <MenuToggle ref={toggleRef} onClick={this.onToggleClick} isExpanded={this.state.isOpen} isDisabled={isDisabled}>
      {label}
    </MenuToggle>
  );

  checkGwHosts = (gwHosts: string): boolean => {
    // All k8s gateway hosts must be valid
    return gwHosts.split(',').every(host => {
      return isK8sGatewayHostValid(host);
    });
  };

  onFormChange = (component: K8sGatewayForm, value: string): void => {
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
            selectedGateway: value,
            isOpen: false
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

  onChangeGatewayClass = (gatewayClass: string): void => {
    this.setState(
      {
        gatewayClass: gatewayClass,
        isOpen: false
      },
      () => this.props.onGatewayChange(this.isGatewayValid(), this.state)
    );
  };

  render(): React.ReactNode {
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
                  <Select
                    id="selectGateway"
                    isOpen={this.state.isOpen}
                    selected={this.state.selectedGateway}
                    onSelect={(_event, k8sGateway) =>
                      this.onFormChange(K8sGatewayForm.GATEWAY_SELECTED, k8sGateway as string)
                    }
                    onOpenChange={(isOpen: boolean) => {
                      this.setState({ isOpen });
                    }}
                    toggle={toggleRef =>
                      this.toggleMenu(
                        toggleRef,
                        this.state.selectedGateway,
                        !this.state.addGateway || this.state.newGateway || this.props.k8sGateways.length === 0
                      )
                    }
                    shouldFocusToggleOnSelect
                  >
                    <SelectList>
                      {this.props.k8sGateways.map(k8sGateway => (
                        <SelectOption key={k8sGateway} value={k8sGateway}>
                          {k8sGateway}
                        </SelectOption>
                      ))}
                    </SelectList>
                  </Select>
                )}
                {this.props.k8sGateways.length === 0 && <>There are no K8s API gateways to select.</>}
              </FormGroup>
            )}

            {this.state.newGateway && (
              <>
                {serverConfig.gatewayAPIClasses.length > 1 && (
                  <FormGroup label="Gateway Class" fieldId="gatewayClass">
                    <Select
                      isOpen={this.state.isOpen}
                      selected={this.state.gatewayClass}
                      onSelect={(_event, gatewayClass) => this.onChangeGatewayClass(gatewayClass as string)}
                      id="gatewayClass"
                      onOpenChange={(isOpen: boolean) => {
                        this.setState({ isOpen });
                      }}
                      toggle={toggleRef => this.toggleMenu(toggleRef, this.state.gatewayClass)}
                      shouldFocusToggleOnSelect
                    >
                      <SelectList>
                        {serverConfig.gatewayAPIClasses.map((option, index) => (
                          <SelectOption key={index} value={option.className}>
                            {option.name}
                          </SelectOption>
                        ))}
                      </SelectList>
                    </Select>
                  </FormGroup>
                )}

                <FormGroup fieldId="gwPort" label="Port">
                  <TextInput
                    id="gwPort"
                    name="gwPort"
                    type="number"
                    isDisabled={!this.state.addGateway || !this.state.newGateway}
                    value={this.state.port}
                    onChange={(_event, value) => this.onFormChange(K8sGatewayForm.PORT, value)}
                  />
                </FormGroup>

                <FormGroup fieldId="gwHosts" label="K8s API Gateway Hosts">
                  <TextInput
                    id="gwHosts"
                    name="gwHosts"
                    isDisabled={!this.state.addGateway || !this.state.newGateway}
                    value={this.state.gwHosts}
                    onChange={(_event, value) => this.onFormChange(K8sGatewayForm.GW_HOSTS, value)}
                    validated={isValid(this.state.gwHostsValid)}
                  />

                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>
                        {isValid(this.state.gwHostsValid)
                          ? 'One or more hosts exposed by this gateway. Enter one or multiple hosts separated by comma'
                          : "K8s API Gateway hosts should be specified using FQDN format or '*.' format. IPs are not allowed."}
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
              </>
            )}
          </>
        )}
      </Form>
    );
  }
}

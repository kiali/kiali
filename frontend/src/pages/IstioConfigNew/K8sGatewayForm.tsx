import * as React from 'react';
import { FormGroup, FormSelect, FormSelectOption } from '@patternfly/react-core';
import { AddressList } from './GatewayForm/AddressList';
import { Address, Listener, MAX_PORT, MIN_PORT } from '../../types/IstioObjects';
import { ListenerList } from './GatewayForm/ListenerList';
import { isValidHostname, isValidName } from './GatewayForm/ListenerBuilder';
import { isValidAddress } from './GatewayForm/AddressBuilder';
import { serverConfig } from '../../config';

export const K8SGATEWAY = 'K8sGateway';
export const K8SGATEWAYS = 'k8sgateways';

type Props = {
  k8sGateway: K8sGatewayState;
  onChange: (k8sGateway: K8sGatewayState) => void;
};

// Gateway and Sidecar states are consolidated in the parent page
export type K8sGatewayState = {
  gatewayClass: string;
  listeners: Listener[];
  addresses: Address[];
  validHosts: boolean;
  listenersForm: ListenerForm[];
};

export const initK8sGateway = (): K8sGatewayState => ({
  gatewayClass: serverConfig.gatewayAPIClasses[0].className,
  listeners: [],
  addresses: [],
  validHosts: false,
  listenersForm: []
});

export const isK8sGatewayStateValid = (g: K8sGatewayState): boolean => {
  return (
    g.listeners.length > 0 && validListeners(g.listeners) && (g.addresses.length === 0 || validAddresses(g.addresses))
  );
};

export type ListenerForm = {
  isHostValid: boolean;
  hostname: string;
  port: string;
  name: string;
  protocol: string;
  from: string;
  isLabelSelectorValid: boolean;
  sSelectorLabels: string;
};

const validListeners = (listeners: Listener[]) => {
  return listeners.every((e, _) => {
    return (
      isValidName(e.name) &&
      typeof e.port !== 'undefined' &&
      e.port >= MIN_PORT &&
      e.port <= MAX_PORT &&
      isValidHostname(e.hostname)
    );
  });
};

const validAddresses = (address: Address[]) => {
  return address.every((a, _) => {
    return isValidAddress(a);
  });
};

export class K8sGatewayForm extends React.Component<Props, K8sGatewayState> {
  constructor(props: Props) {
    super(props);
    this.state = initK8sGateway();
  }

  componentDidMount() {
    this.setState(this.props.k8sGateway);
  }

  onChangeListener = (listeners: Listener[], listenersForm: ListenerForm[]) => {
    this.setState({ listeners: listeners, listenersForm: listenersForm }, () => this.props.onChange(this.state));
  };

  onChangeAddress = (addresses: Address[]) => {
    this.setState({ addresses: addresses }, () => this.props.onChange(this.state));
  };

  onChangeGatewayClass = (_event, value) => {
    this.setState(
      {
        gatewayClass: value
      },
      () => this.props.onChange(this.state)
    );
  };

  render() {
    return (
      <>
        {serverConfig.gatewayAPIClasses.length > 1 && (
          <FormGroup label="Gateway Class" fieldId="gatewayClass">
            <FormSelect
              value={this.state.gatewayClass}
              onChange={this.onChangeGatewayClass}
              id="gatewayClass"
              name="gatewayClass"
            >
              {serverConfig.gatewayAPIClasses.map((option, index) => (
                <FormSelectOption key={index} value={option.className} label={option.name} />
              ))}
            </FormSelect>
          </FormGroup>
        )}
        <FormGroup label="Listeners" fieldId="listener" isRequired={true}>
          <ListenerList
            onChange={this.onChangeListener}
            listenersForm={this.state.listenersForm}
            listeners={this.state.listeners}
          />
        </FormGroup>
        <FormGroup label="Addresses" fieldId="gwAddressList">
          <AddressList onChange={this.onChangeAddress} addressList={this.state.addresses} />
        </FormGroup>
      </>
    );
  }
}

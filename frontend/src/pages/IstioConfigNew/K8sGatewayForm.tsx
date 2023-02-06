import * as React from 'react';
// Use TextInputBase like workaround while PF4 team work in https://github.com/patternfly/patternfly-react/issues/4072
import { FormGroup } from '@patternfly/react-core';
import ListenerBuilder from "./GatewayForm/ListenerBuilder";
import AddressBuilder from "./GatewayForm/AddressBuilder";
import ListenerList from "./GatewayForm/ListenerList";
import AddressList from "./GatewayForm/AddressList";
import {Address, Listener} from '../../types/IstioObjects';

export const K8SGATEWAY = 'K8sGateway';
export const K8SGATEWAYS = 'k8sgateways';

type Props = {
  k8sGateway: K8sGatewayState;
  onChange: (k8sGateway: K8sGatewayState) => void;
};

// Gateway and Sidecar states are consolidated in the parent page
export type K8sGatewayState = {
  listeners: Listener[];
  addresses: Address[];
  addListener: Listener;
  addAddress: Address;
  validHosts: boolean;
};

export const initK8sGateway = (): K8sGatewayState => ({
  listeners: [],
  addresses: [],
  addListener: {
    hostname: '',
    port: 80,
    name: 'default',
    protocol: 'HTTP',
    allowedRoutes: {namespaces: {from: "Same", selector: {matchLabels: {}}}}
  },
  addAddress: {
    type: 'IPAddress',
    value: '',
  },
  validHosts: false
});

export const isK8sGatewayStateValid = (g: K8sGatewayState): boolean => {
  return g.listeners.length > 0;
};

class K8sGatewayForm extends React.Component<Props, K8sGatewayState> {
  constructor(props: Props) {
    super(props);
    this.state = initK8sGateway();
  }

  componentDidMount() {
    this.setState(this.props.k8sGateway);
  }

  onAddListener = () => {
    this.setState(
      prevState => {
        prevState.listeners.push(prevState.addListener);
        return {
          listeners: prevState.listeners,
          addListener: {
            hostname: '',
            port: 80,
            name: 'http',
            protocol: 'HTTP',
            allowedRoutes: {namespaces: {from: "Same", selector: {matchLabels: {}}}}
          }
        };
      },
      () => this.props.onChange(this.state)
    );
  };

  onRemoveListener = (index: number) => {
    this.setState(
      prevState => {
        prevState.listeners.splice(index, 1);
        return {
          listeners: prevState.listeners
        };
      },
      () => this.props.onChange(this.state)
    );
  };

  onAddAddress = () => {
    this.setState(
      prevState => {
        prevState.addresses.push(prevState.addAddress);
        return {
          addresses: prevState.addresses,
          addAddress: {
            type: 'IPAddress',
            value: '',
          }
        };
      },
      () => this.props.onChange(this.state)
    );
  };

  onRemoveAddress = (index: number) => {
    this.setState(
      prevState => {
        prevState.addresses.splice(index, 1);
        return {
          addresses: prevState.addresses
        };
      },
      () => this.props.onChange(this.state)
    );
  };

  render() {
    return (
      <>
        <FormGroup label="Listeners" fieldId="listener" isRequired={true}>
          <ListenerBuilder
            onAddListener={listener => {
              this.setState(
                {
                  addListener: listener
                },
                () => this.onAddListener()
              );
            }}
          />
          <ListenerList listenerList={this.state.listeners} onRemoveListener={this.onRemoveListener} />
        </FormGroup>
        <FormGroup label="Addresses" fieldId="gwAddressList">
          <AddressBuilder
            onAddAddress={address => {
              this.setState(
                {
                  addAddress: address
                },
                () => this.onAddAddress()
              );
            }}
          />
          <AddressList addressList={this.state.addresses} onRemoveAddress={this.onRemoveAddress} />
        </FormGroup>
      </>
    );
  }
}

export default K8sGatewayForm;

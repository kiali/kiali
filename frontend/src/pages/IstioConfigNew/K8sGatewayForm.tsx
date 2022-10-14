import * as React from 'react';
// Use TextInputBase like workaround while PF4 team work in https://github.com/patternfly/patternfly-react/issues/4072
import { FormGroup, TextInputBase as TextInput } from '@patternfly/react-core';
import ListenerBuilder from "./GatewayForm/ListenerBuilder";
import AddressBuilder from "./GatewayForm/AddressBuilder";
import ListenerList from "./GatewayForm/ListenerList";
import AddressList from "./GatewayForm/AddressList";
import {Address, Listener} from '../../types/IstioObjects';
import { isValid } from 'utils/Common';

export const K8SGATEWAY = 'K8sGateway';
export const K8SGATEWAYS = 'k8sgateways';

type Props = {
  k8sGateway: K8sGatewayState;
  onChange: (k8sGateway: K8sGatewayState) => void;
};

// Gateway and Sidecar states are consolidated in the parent page
export type K8sGatewayState = {
  workloadSelectorValid: boolean;
  workloadSelectorLabels: string;
  listeners: Listener[];
  addresses: Address[];
  addListener: Listener;
  addAddress: Address;
  validHosts: boolean;
};

export const initK8sGateway = (): K8sGatewayState => ({
  workloadSelectorLabels: 'app=gatewayapi',
  workloadSelectorValid: true,
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
  return g.workloadSelectorValid && g.listeners.length > 0;
};

class K8sGatewayForm extends React.Component<Props, K8sGatewayState> {
  constructor(props: Props) {
    super(props);
    this.state = initK8sGateway();
  }

  componentDidMount() {
    this.setState(this.props.k8sGateway);
  }

  addWorkloadLabels = (value: string, _) => {
    if (value.length === 0) {
      this.setState(
        {
          workloadSelectorValid: false,
          workloadSelectorLabels: ''
        },
        () => this.props.onChange(this.state)
      );
      return;
    }
    value = value.trim();
    const labels: string[] = value.split(',');
    let isValid = true;
    // Some smoke validation rules for the labels
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      if (label.indexOf('=') < 0) {
        isValid = false;
        break;
      }
      const splitLabel: string[] = label.split('=');
      if (splitLabel.length !== 2) {
        isValid = false;
        break;
      }
      if (splitLabel[0].trim().length === 0 || splitLabel[1].trim().length === 0) {
        isValid = false;
        break;
      }
    }
    this.setState(
      {
        workloadSelectorValid: isValid,
        workloadSelectorLabels: value
      },
      () => this.props.onChange(this.state)
    );
  };

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
        <FormGroup
          fieldId="workloadLabels"
          label="Labels"
          helperText="One or more labels to select a workload where the Gateway is applied."
          helperTextInvalid="Enter a label in the format <label>=<value>. Enter one or multiple labels separated by comma."
          validated={isValid(this.state.workloadSelectorValid)}
        >
          <TextInput
            id="gwLabels"
            name="gwLabels"
            value={this.state.workloadSelectorLabels}
            onChange={this.addWorkloadLabels}
            validated={isValid(this.state.workloadSelectorValid)}
          />
        </FormGroup>
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

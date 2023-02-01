import * as React from 'react';
// Use TextInputBase like workaround while PF4 team work in https://github.com/patternfly/patternfly-react/issues/4072
import { FormGroup } from '@patternfly/react-core';
import AddressBuilder from "./GatewayForm/AddressBuilder";
import AddressList from "./GatewayForm/AddressList";
import {Address, Listener} from '../../types/IstioObjects';
import ListenerList from "./GatewayForm/ListenerList";

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
  addAddress: Address;
  validHosts: boolean;
  listenersForm: ListenerForm[];
};

export const initK8sGateway = (): K8sGatewayState => ({
  listeners: [],
  addresses: [],
  addAddress: {
    type: 'IPAddress',
    value: '',
  },
  validHosts: false,
  listenersForm: [],
});

export const isK8sGatewayStateValid = (g: K8sGatewayState): boolean => {
  return g.listeners.length > 0;
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
}

class K8sGatewayForm extends React.Component<Props, K8sGatewayState> {
  constructor(props: Props) {
    super(props);
    this.state = initK8sGateway();
  }

  componentDidMount() {
    this.setState(this.props.k8sGateway);
  }

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

  onChangeListener = (listeners: Listener[], listenersForm: ListenerForm[]) => {
    this.setState(
      { listeners: listeners, listenersForm: listenersForm}
    );
  }

  render() {
    return (
      <>
        <FormGroup label="Listeners" fieldId="listener" isRequired={true}>
          <ListenerList  onChange={this.onChangeListener}
                         listenersForm={this.state.listenersForm}
                         listeners={this.state.listeners}
                         />
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

/*  onAddListener = () => {
    const newListener : ListenerForm = {
      hostname: '',
      port: '',
      name: 'http',
      protocol: 'HTTP',
      isHostValid: false,
      from: '',
      isLabelSelectorValid: false,
      sSelectorLabels: ''
    }
    const l = this.state.listenersForm
    l.push(newListener)
    this.setState(
      {listenersForm: l}
    );
  };

  onRemoveListener = (index: number) => {
    const l = this.state.listenersForm
    l.splice(index,1)
    this.setState(
      {listenersForm: l}
    );

  };

  onAddName = (value: string, e: FormEvent<HTMLInputElement>) => {
    const index = e.currentTarget.name
    const l = this.state.listenersForm
    l[index].name = value
    this.setState(
      {listenersForm: l}
    );
  };

  rows() {
    return (this.state.listenersForm || [])
      .map((listener, i) => ({
        key: 'listener'+i,
        cells: [
          <>
            <TextInput
              value={listener.name}
              type="text"
              id="addName"
              aria-describedby="add name"
              name={i.toString()}
              onChange={this.onAddName}
              validated={isValid(listener.name !== undefined && listener.name.length > 0)}
            />
          </>,
          <>
            <TextInput
              value={listener.hostname}
              type="text"
              id="addHostname"
              aria-describedby="add hostname"
              name="addHostname"
              validated={isValid(listener.hostname !== undefined && listener.hostname.length > 0 && /[.+\..+]/.test(listener.hostname))}
            />
          </>,
          <>
            <TextInput
              value={listener.port}
              type="text"
              id="addPort"
              placeholder="80"
              aria-describedby="add port"
              name="addPortNumber"
            />
          </>,
          <>
            <FormSelect
              value={listener.protocol}
              id="addPortProtocol"
              name="addPortProtocol"
            >
              {protocols.map((option, index) => (
                <FormSelectOption isDisabled={false} key={'p' + index} value={option} label={option} />
              ))}
            </FormSelect>
          </>,
          <>
            <FormSelect
              value={listener}
              id="addFrom"
              name="addFrom"
            >
              {allowedRoutes.map((option, index) => (
                <FormSelectOption isDisabled={false} key={'p' + index} value={option} label={option} />
              ))}
            </FormSelect>
          </>,
          <>
            <TextInput
              id="addSelectorLabels"
              name="addSelectorLabels"
            />
          </>,
          <>
            <Button
              id="deleteBtn"
              variant={ButtonVariant.link}
              icon={<TrashIcon />}
              style={{padding: 0}}
              onClick={() => this.onRemoveListener(i)}
            />
          </>
        ]
      })).concat([{
        key: 'newListener',
        cells: [
          <>
            <Button
              variant={ButtonVariant.link}
              icon={<PlusCircleIcon/>}
              onClick={this.onAddListener}
              //className={addListenerStyle}
            >
              Add Listener to Listener List
            </Button>
          </>
        ]
      }]);
  }*/


}

export default K8sGatewayForm;

import * as React from 'react';
import { isGatewayHostValid } from '../../../utils/IstioConfigUtils';
import {Button, ButtonVariant, FormSelect, FormSelectOption, TextInput} from "@patternfly/react-core";
import {isValid} from "../../../utils/Common";
import {TrashIcon} from "@patternfly/react-icons";
import {ListenerForm} from "../K8sGatewayForm";
import {Td, Tr} from '@patternfly/react-table';
import {addSelectorLabels} from "./ListenerList";

type Props = {
  listener: ListenerForm;
  onRemoveListener: (i: number) => void;
  index: number;
  onChange: (listenerForm: ListenerForm, i: number) => void;
};

type State = {
  isHostValid: boolean;
  newHostname: string;
  newPort: string;
  newName: string;
  newProtocol: string;
  newFrom: string;
  isLabelSelectorValid: boolean;
  newSelectorLabels: string;
};

// Only HTTPRoute is supported in Istio
const protocols = ['HTTP'];
const allowedRoutes = ['All', 'Selector', 'Same'];


class ListenerBuilder extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      newHostname: '',
      isHostValid: false,
      newPort: '',
      newName: '',
      newProtocol: protocols[0],
      newFrom: allowedRoutes[2],
      newSelectorLabels: '',
      isLabelSelectorValid: false,
    };
  }

  isValidHost = (host: string): boolean => {
    return isGatewayHostValid(host);
  };

  onAddHostname = (value: string, _) => {
    const l = this.props.listener
    l.hostname = value.trim()

    this.props.onChange(l, this.props.index)

    this.setState({
      newHostname: value,
      isHostValid: this.isValidHost(value)
    });
  };

  onAddPort = (value: string, _) => {
    const l = this.props.listener
    l.port = value.trim()

    this.props.onChange(l, this.props.index)
  };

  onAddName = (value: string, _) => {
    const l = this.props.listener
    l.name = value.trim()

    this.props.onChange(l, this.props.index)
  };

  onAddProtocol = (value: string, _) => {
    const l = this.props.listener
    l.protocol = value.trim()

    this.props.onChange(l, this.props.index)
  };

  onAddFrom = (value: string, _) => {
    const l = this.props.listener
    l.from = value.trim()

    this.props.onChange(l, this.props.index)
  };

  onAddSelectorLabels = (value: string, _) => {
    const l = this.props.listener
    l.sSelectorLabels = value.trim()

    this.props.onChange(l, this.props.index)
  };

  render() {
    return (
      <Tr>
      <Td>
        <TextInput
          value={this.props.listener.name}
          type="text"
          id="addName"
          aria-describedby="add name"
          onChange={this.onAddName}
          validated={isValid(this.props.listener.name !== undefined && this.props.listener.name.length > 0)}
        />
      </Td>
        <Td>
          <TextInput
            value={this.props.listener.hostname}
            type="text"
            id="addHostname"
            aria-describedby="add hostname"
            name="addHostname"
            onChange={this.onAddHostname}
            validated={isValid(this.props.listener.hostname !== undefined && this.props.listener.hostname.length > 0 && isGatewayHostValid(this.props.listener.hostname))}
          />
        </Td>
        <Td>
          <TextInput
            value={this.props.listener.port}
            type="text"
            id="addPort"
            placeholder="80"
            aria-describedby="add port"
            name="addPortNumber"
            onChange={this.onAddPort}
            validated={isValid(this.props.listener.port.length > 0 && !isNaN(Number(this.props.listener.port)) && Number(this.props.listener.port) >= 0 &&
              Number(this.props.listener.port) <= 65535)  }
          />
        </Td>
        <Td>
          <FormSelect
            value={this.props.listener.protocol}
            id="addPortProtocol"
            name="addPortProtocol"
            onChange={this.onAddProtocol}
          >
            {protocols.map((option, index) => (
              <FormSelectOption isDisabled={false} key={'p' + index} value={option} label={option} />
            ))}
          </FormSelect>
        </Td>
        <Td>
          <FormSelect
            value={this.props.listener.from}
            id="addFrom"
            name="addFrom"
            onChange={this.onAddFrom}
          >
            {allowedRoutes.map((option, index) => (
              <FormSelectOption isDisabled={false} key={'p' + index} value={option} label={option} />
            ))}
          </FormSelect>
        </Td>
        <Td>
          <TextInput
            id="addSelectorLabels"
            name="addSelectorLabels"
            onChange={this.onAddSelectorLabels}
            validated={isValid(this.props.listener.sSelectorLabels.length === 0 || typeof(addSelectorLabels(this.props.listener.sSelectorLabels)) !== "undefined")}
          />
        </Td>
        <Td>
          <Button
            id="deleteBtn"
            variant={ButtonVariant.link}
            icon={<TrashIcon />}
            style={{padding: 0}}
            onClick={() => this.props.onRemoveListener(this.props.index)}
          />
        </Td>
      </Tr>
    );
  }
}

export default ListenerBuilder;



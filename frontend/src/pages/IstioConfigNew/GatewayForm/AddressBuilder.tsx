import * as React from 'react';
import { Button, ButtonVariant, FormSelect, FormSelectOption } from '@patternfly/react-core';
import { TextInputBase as TextInput } from '@patternfly/react-core/dist/js/components/TextInput/TextInput';
import { Td, Tr } from '@patternfly/react-table';
import { TrashIcon } from '@patternfly/react-icons';
import { Address } from '../../../types/IstioObjects';
import { isValid } from 'utils/Common';
import { isGatewayHostValid, isValidIp } from '../../../utils/IstioConfigUtils';

type Props = {
  address: Address;
  onRemoveAddress: (i: number) => void;
  onChange: (address: Address, i: number) => void;
  index: number;
};

type State = {
  isValueValid: boolean;
  newType: string;
  newValue: string;
};

export const isValidAddress = (address: Address) => {
  if (address.type === addressTypes[0]) {
    return isValidIp(address.value);
  }
  if (address.type === addressTypes[1]) {
    return isGatewayHostValid(address.value);
  }
  return false;
};

export const addressTypes = ['IPAddress', 'Hostname'];

export class AddressBuilder extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      isValueValid: false,
      newType: addressTypes[0],
      newValue: ''
    };
  }

  onAddValue = (value: string) => {
    const l = this.props.address;
    l.value = value.trim();

    this.props.onChange(l, this.props.index);
  };

  onAddType = (value: string, _) => {
    const l = this.props.address;
    l.type = value.trim();

    this.props.onChange(l, this.props.index);
  };

  render() {
    return (
      <Tr>
        <Td>
          <FormSelect
            value={this.props.address.type}
            id={'addType' + this.props.index}
            name="addType"
            onChange={this.onAddType}
          >
            {addressTypes.map((option, index) => (
              <FormSelectOption isDisabled={false} key={'p' + index} value={option} label={option} />
            ))}
          </FormSelect>
        </Td>
        <Td>
          <TextInput
            value={this.props.address.value}
            type="text"
            id={'addValue' + this.props.index}
            aria-describedby="add value"
            name="addVale"
            onChange={this.onAddValue}
            validated={isValid(isValidAddress(this.props.address))}
          />
        </Td>
        <Td>
          <Button
            id="deleteBtn"
            variant={ButtonVariant.link}
            icon={<TrashIcon />}
            style={{ padding: 0 }}
            onClick={() => this.props.onRemoveAddress(this.props.index)}
          />
        </Td>
      </Tr>
    );
  }
}

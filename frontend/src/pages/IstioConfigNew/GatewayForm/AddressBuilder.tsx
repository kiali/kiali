import * as React from 'react';
import { Button, ButtonVariant, FormSelect, FormSelectOption, TextInput } from '@patternfly/react-core';
import { Td, Tr } from '@patternfly/react-table';
import { Address } from '../../../types/IstioObjects';
import { isValid } from 'utils/Common';
import { isGatewayHostValid, isValidIp } from '../../../utils/IstioConfigUtils';
import { KialiIcon } from 'config/KialiIcon';

type AddressBuilderProps = {
  address: Address;
  index: number;
  onRemoveAddress: (i: number) => void;
  onChange: (address: Address, i: number) => void;
};

export const isValidAddress = (address: Address): boolean => {
  if (address.type === addressTypes[0]) {
    return isValidIp(address.value);
  }

  if (address.type === addressTypes[1]) {
    return isGatewayHostValid(address.value);
  }

  return false;
};

export const addressTypes = ['IPAddress', 'Hostname'];

export const AddressBuilder: React.FC<AddressBuilderProps> = (props: AddressBuilderProps) => {
  const onAddValue = (_event: React.FormEvent, value: string): void => {
    const l = props.address;
    l.value = value.trim();

    props.onChange(l, props.index);
  };

  const onAddType = (_event: React.FormEvent, value: string): void => {
    const l = props.address;
    l.type = value.trim();

    props.onChange(l, props.index);
  };

  return (
    <Tr>
      <Td>
        <FormSelect value={props.address.type} id={`addType_${props.index}`} name="addType" onChange={onAddType}>
          {addressTypes.map((option, index) => (
            <FormSelectOption isDisabled={false} key={`p_${index}`} value={option} label={option} />
          ))}
        </FormSelect>
      </Td>

      <Td>
        <TextInput
          value={props.address.value}
          type="text"
          id={`addValue_${props.index}`}
          aria-describedby="add value"
          name="addVale"
          onChange={onAddValue}
          validated={isValid(isValidAddress(props.address))}
        />
      </Td>

      <Td>
        <Button
          id="deleteBtn"
          variant={ButtonVariant.link}
          icon={<KialiIcon.Trash />}
          style={{ padding: 0 }}
          onClick={() => props.onRemoveAddress(props.index)}
        />
      </Td>
    </Tr>
  );
};

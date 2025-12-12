import * as React from 'react';
import {
  Button,
  ButtonVariant,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  TextInput
} from '@patternfly/react-core';
import { Td, Tr } from '@patternfly/react-table';
import { Address } from '../../../types/IstioObjects';
import { isValid } from 'utils/Common';
import { isGatewayHostValid, isValidIp } from '../../../utils/IstioConfigUtils';
import { KialiIcon } from 'config/KialiIcon';

type AddressBuilderProps = {
  address: Address;
  index: number;
  onChange: (address: Address, i: number) => void;
  onRemoveAddress: (i: number) => void;
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
  const [isTypeSelectOpen, setIsTypeSelectOpen] = React.useState<boolean>(false);

  const onAddValue = (_event: React.FormEvent, value: string): void => {
    props.onChange({ ...props.address, value: value.trim() }, props.index);
  };

  const onAddType = (value: string): void => {
    setIsTypeSelectOpen(false);
    props.onChange({ ...props.address, type: value.trim() }, props.index);
  };

  return (
    <Tr>
      <Td>
        <Select
          id={`addType_${props.index}`}
          isOpen={isTypeSelectOpen}
          selected={props.address.type}
          onSelect={(_event, value) => onAddType(value as string)}
          onOpenChange={setIsTypeSelectOpen}
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              id={`addType_${props.index}-toggle`}
              ref={toggleRef}
              onClick={() => setIsTypeSelectOpen(!isTypeSelectOpen)}
              isExpanded={isTypeSelectOpen}
              isFullWidth
            >
              {props.address.type}
            </MenuToggle>
          )}
          aria-label="Address Type Select"
        >
          <SelectList>
            {addressTypes.map((option, index) => (
              <SelectOption key={`p_${index}`} value={option}>
                {option}
              </SelectOption>
            ))}
          </SelectList>
        </Select>
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

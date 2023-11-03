import * as React from 'react';
import { Address } from '../../../types/IstioObjects';
import { Table, Tbody, Td, Th, Thead, ThProps, Tr } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { Button, ButtonVariant } from '@patternfly/react-core';
import { AddressBuilder } from './AddressBuilder';
import { PFColors } from '../../../components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';

type AddressListProps = {
  addressList: Address[];
  onChange: (address: Address[]) => void;
};

const noAddressStyle = kialiStyle({
  color: PFColors.Red100,
  textAlign: 'center'
});

const addAddressStyle = kialiStyle({
  marginLeft: '0.5rem',
  marginTop: '0.25rem'
});

const columns: ThProps[] = [
  {
    title: '',
    width: 40
  },
  {
    title: '',
    width: 60
  }
];

export const AddressList: React.FC<AddressListProps> = (props: AddressListProps) => {
  const onAddAddress = (): void => {
    const newAddress: Address = {
      type: 'IPAddress',
      value: ''
    };

    const l = props.addressList;
    l.push(newAddress);

    props.onChange(l);
  };

  const onRemoveAddress = (index: number): void => {
    const l = props.addressList;
    l.splice(index, 1);

    props.onChange(l);
  };

  const onChange = (address: Address, i: number): void => {
    const l = props.addressList;
    l[i] = address;

    props.onChange(l);
  };

  return (
    <>
      <Table aria-label="Address List">
        <Thead>
          <Tr>
            {columns.map((column, index) => (
              <Th key={`column_${index}`} dataLabel={column.title} width={column.width}>
                {column.title}
              </Th>
            ))}
          </Tr>
        </Thead>

        <Tbody>
          {props.addressList.length > 0 ? (
            <>
              {props.addressList.map((address, index) => (
                <AddressBuilder
                  key={`address_builder_${index}`}
                  address={address}
                  onRemoveAddress={onRemoveAddress}
                  index={index}
                  onChange={onChange}
                ></AddressBuilder>
              ))}
            </>
          ) : (
            <Tr>
              <Td colSpan={columns.length}>
                <div className={noAddressStyle}>No Addresses defined</div>
              </Td>
            </Tr>
          )}
        </Tbody>
      </Table>

      <Button
        name="addAddress"
        variant={ButtonVariant.link}
        icon={<KialiIcon.AddMore />}
        onClick={onAddAddress}
        className={addAddressStyle}
      >
        Add Address to Addresses List
      </Button>
    </>
  );
};

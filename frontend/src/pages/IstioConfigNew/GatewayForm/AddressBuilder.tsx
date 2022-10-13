import * as React from 'react';
import { Button, ButtonVariant, FormSelect, FormSelectOption } from '@patternfly/react-core';
import { TextInputBase as TextInput } from '@patternfly/react-core/dist/js/components/TextInput/TextInput';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { style } from 'typestyle';
import { PFColors } from '../../../components/Pf/PfColors';
import { PlusCircleIcon } from '@patternfly/react-icons';
import {isGatewayHostValid, isValidIp} from '../../../utils/IstioConfigUtils';
import { Address } from '../../../types/IstioObjects';
import { isValid } from 'utils/Common';

type Props = {
  onAddAddress: (address: Address) => void;
};

type State = {
  isValueValid: boolean;
  newType: string;
  newValue: string;
};

const warningStyle = style({
  marginLeft: 25,
  color: PFColors.Red100,
  textAlign: 'center'
});

const addAddressStyle = style({
  marginLeft: 0,
  paddingLeft: 0
});

const addressHeader: ICell[] = [
  {
    title: 'Type',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: 'Value',
    transforms: [cellWidth(20) as any],
    props: {}
  },
];

const addressTypes = ['IPAddress', 'Hostname'];


class AddressBuilder extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      isValueValid: false,
      newType: addressTypes[0],
      newValue: '',
    };
  }

  canAddAddress = (): boolean => {
    return this.state.isValueValid;
  };

  isValueValid = (value: string): boolean => {
    if (this.state.newType === addressTypes[0]) {
      return isValidIp(value)
    }
    if (this.state.newType === addressTypes[1]) {
      return isGatewayHostValid(value)
    }
    return false;
  };

  onAddValue = (value: string, _) => {
    this.setState({
      newValue: value,
      isValueValid: this.isValueValid(value)
    });
  };

  onAddType = (value: string, _) => {
    this.setState({
      newType: value
    });
  };

  onAddAddress = () => {
    const newAddress: Address = {
      type: this.state.newType,
      value: this.state.newValue,
    };
    this.setState(
      {
        isValueValid: false,
        newType: addressTypes[0],
        newValue: '',
      },
      () => this.props.onAddAddress(newAddress)
    );
  };

  addressRows() {
    return [
      {
        keys: 'gatewayAddressNew',
        cells: [
          <>
            <FormSelect
              value={this.state.newType}
              id="addType"
              name="addType"
              onChange={this.onAddType}
            >
              {addressTypes.map((option, index) => (
                <FormSelectOption isDisabled={false} key={'p' + index} value={option} label={option} />
              ))}
            </FormSelect>
          </>,
          <>
            <TextInput
              value={this.state.newValue}
              type="text"
              id="addValue"
              aria-describedby="add value"
              name="addVale"
              onChange={this.onAddValue}
              validated={isValid(this.state.isValueValid)}
            />
          </>,
        ]
      }
    ];
  }

  render() {
    return (
      <>
        <Table aria-label="Address Rows" cells={addressHeader} rows={this.addressRows()}>
          <TableHeader />
          <TableBody />
        </Table>
        <Button
          variant={ButtonVariant.link}
          icon={<PlusCircleIcon />}
          onClick={this.onAddAddress}
          isDisabled={!this.canAddAddress()}
          className={addAddressStyle}
        >
          Add Address to Address List
        </Button>
        {!this.canAddAddress() && <span className={warningStyle}>A Address needs Type and Value sections defined</span>}
      </>
    );
  }
}

export default AddressBuilder;

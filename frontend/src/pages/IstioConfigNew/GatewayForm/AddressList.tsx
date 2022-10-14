import * as React from 'react';
import { Address } from '../../../types/IstioObjects';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { style } from 'typestyle';
import { PFColors } from '../../../components/Pf/PfColors';

type Props = {
  addressList: Address[];
  onRemoveAddress: (index: number) => void;
};

const noAddressStyle = style({
  marginTop: 10,
  color: PFColors.Red100,
  textAlign: 'center',
  width: '100%'
});

const headerCells: ICell[] = [
  {
    title: '',
    transforms: [cellWidth(40) as any],
    props: {}
  },
  {
    title: '',
    transforms: [cellWidth(60) as any],
    props: {}
  },
];

class AddressList extends React.Component<Props> {
  rows = () => {
    return this.props.addressList.map((address, i) => {
      return {
        key: 'address_' + i,
        cells: [
          <>
            <div>{address.type}</div>
          </>,
          <>
            <div>{address.value}</div>
          </>,
        ]
      };
    });
  };

  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove Address',
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => {
        this.props.onRemoveAddress(rowIndex);
      }
    };
    return [removeAction];
  };

  render() {
    return (
      <>
        <Table
          aria-label="Address List"
          cells={headerCells}
          rows={this.rows()}
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <TableHeader />
          <TableBody />
        </Table>
        {this.props.addressList.length === 0 && <div className={noAddressStyle}>No Addresses defined</div>}
      </>
    );
  }
}

export default AddressList;

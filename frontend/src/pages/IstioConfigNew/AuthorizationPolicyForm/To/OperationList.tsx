import * as React from 'react';
import { Table, Tbody, Thead, Tr, Th, Td } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../../components/Pf/PfColors';

type Props = {
  toList: { [key: string]: string[] }[];
  onRemoveTo: (index: number) => void;
};

const noOperationsStyle = kialiStyle({
  marginTop: 10,
  color: PFColors.Red100,
  textAlign: 'center',
  width: '100%'
});

export class OperationList extends React.Component<Props> {
  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove To',
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => {
        this.props.onRemoveTo(rowIndex);
      }
    };
    return [removeAction];
  };

  render() {
    return (
      <>
        <Table
          aria-label="Source Builder"
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <Thead>
            <Tr>
              <Th width={100}>Operations of a Request</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {this.props.toList.map((operation, i) => (
              <Tr key={`toOperation${i}`}>
                <Td>
                  {Object.keys(operation).map((field, j) => {
                    return (
                      <div key={'operationField_' + i + '_' + j}>
                        <b>{field}</b>: [{operation[field].join(',')}]<br />
                      </div>
                    );
                  })}
                </Td>
                <Td />
              </Tr>
            ))}
          </Tbody>
        </Table>
        {this.props.toList.length === 0 && <div className={noOperationsStyle}>No Operations Defined</div>}
      </>
    );
  }
}

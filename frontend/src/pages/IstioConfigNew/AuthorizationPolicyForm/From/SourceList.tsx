import * as React from 'react';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../../components/Pf/PfColors';

type Props = {
  fromList: { [key: string]: string[] }[];
  onRemoveFrom: (index: number) => void;
};

const noSourceStyle = kialiStyle({
  marginTop: 10,
  color: PFColors.Red100,
  textAlign: 'center',
  width: '100%'
});

export class SourceList extends React.Component<Props> {
  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove From',
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => {
        this.props.onRemoveFrom(rowIndex);
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
              <Th width={100}>Source Matches of a Request</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {this.props.fromList.map((source, i) => (
              <Tr key={i}>
                <Td>
                  Rules
                  {Object.keys(source).map((field, j) => {
                    return (
                      <div key={'sourceField_' + field + '_' + i + '_' + j}>
                        <b>{field}</b>: [{source[field].join(',')}]<br />
                      </div>
                    );
                  })}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        {this.props.fromList.length === 0 && <div className={noSourceStyle}>No Source Matches Defined</div>}
      </>
    );
  }
}

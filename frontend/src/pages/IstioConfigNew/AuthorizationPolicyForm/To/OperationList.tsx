import * as React from 'react';
import { cellWidth, ICell } from '@patternfly/react-table';
import { Table, TableBody, TableHeader } from '@patternfly/react-table/deprecated';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../../components/Pf/PfColors';

type Props = {
  toList: { [key: string]: string[] }[];
  onRemoveTo: (index: number) => void;
};

const headerCells: ICell[] = [
  {
    title: $t('title32', 'Operations of a Request'),
    transforms: [cellWidth(100) as any],
    props: {}
  },
  {
    title: '',
    props: {}
  }
];

const noOperationsStyle = kialiStyle({
  marginTop: 10,
  color: PFColors.Red100,
  textAlign: 'center',
  width: '100%'
});

export class OperationList extends React.Component<Props> {
  rows = () => {
    return this.props.toList.map((operation, i) => {
      return {
        key: 'toOperation' + i,
        cells: [
          <>
            {Object.keys(operation).map((field, j) => {
              return (
                <div key={'operationField_' + i + '_' + j}>
                  <b>{field}</b>: [{operation[field].join(',')}]<br />
                </div>
              );
            })}
          </>,
          <></>
        ]
      };
    });
  };

  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: $t('RemoveTo', 'Remove To'),
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
          cells={headerCells}
          rows={this.rows()}
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <TableHeader />
          <TableBody />
        </Table>
        {this.props.toList.length === 0 && (
          <div className={noOperationsStyle}>{$t('NoOperationsDefined', 'No Operations Defined')}</div>
        )}
      </>
    );
  }
}

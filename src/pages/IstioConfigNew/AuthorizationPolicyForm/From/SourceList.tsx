import * as React from 'react';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { style } from 'typestyle';
import { PfColors } from '../../../../components/Pf/PfColors';

type Props = {
  fromList: { [key: string]: string[] }[];
  onRemoveFrom: (index: number) => void;
};

const headerCells: ICell[] = [
  {
    title: 'Source Matches of a Request',
    transforms: [cellWidth(100) as any],
    props: {}
  },
  {
    title: '',
    props: {}
  }
];

const noSourceStyle = style({
  marginTop: 10,
  color: PfColors.Red100,
  textAlign: 'center',
  width: '100%'
});

class SourceList extends React.Component<Props> {
  rows = () => {
    return this.props.fromList.map((source, i) => {
      return {
        key: 'fromSource' + i,
        cells: [
          <>
            Rules
            {Object.keys(source).map((field, j) => {
              return (
                <div key={'sourceField_' + field + '_' + i + '_' + j}>
                  <b>{field}</b>: [{source[field].join(',')}]<br />
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
          cells={headerCells}
          rows={this.rows()}
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <TableHeader />
          <TableBody />
        </Table>
        {this.props.fromList.length === 0 && <div className={noSourceStyle}>No Source Matches Defined</div>}
      </>
    );
  }
}

export default SourceList;

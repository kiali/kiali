import * as React from 'react';
import { Condition } from './ConditionBuilder';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { style } from 'typestyle';
import { PFColors } from '../../../../components/Pf/PfColors';

type Props = {
  conditionList: Condition[];
  onRemoveCondition: (index: number) => void;
};

const headerCells: ICell[] = [
  {
    title: 'Additional Conditions of a Request',
    transforms: [cellWidth(100) as any],
    props: {}
  },
  {
    title: '',
    props: {}
  }
];

const noConditionsStyle = style({
  marginTop: 10,
  color: PFColors.Red100,
  textAlign: 'center',
  width: '100%'
});

class ConditionList extends React.Component<Props> {
  rows = () => {
    return this.props.conditionList.map((condition, i) => {
      return {
        key: 'condition' + i,
        cells: [
          <>
            <b>key: </b> [{condition.key}]<br />
            {condition.values && (
              <>
                <b>values: </b> [{condition.values.join(',')}]<br />
              </>
            )}
            {condition.notValues && (
              <>
                <b>notValues: </b> [{condition.notValues.join(',')}]<br />
              </>
            )}
          </>,
          <></>
        ]
      };
    });
  };

  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove Condition',
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => {
        this.props.onRemoveCondition(rowIndex);
      }
    };
    return [removeAction];
  };

  render() {
    return (
      <>
        <Table
          aria-label="Condition Builder"
          cells={headerCells}
          rows={this.rows()}
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <TableHeader />
          <TableBody />
        </Table>
        {this.props.conditionList.length === 0 && <div className={noConditionsStyle}>No Conditions Defined</div>}
      </>
    );
  }
}

export default ConditionList;

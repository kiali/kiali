import * as React from 'react';
import { Condition } from './ConditionBuilder';
import { Table, Tbody, Thead, Tr, Th, Td } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../../components/Pf/PfColors';

type Props = {
  conditionList: Condition[];
  onRemoveCondition: (index: number) => void;
};

const noConditionsStyle = kialiStyle({
  marginTop: 10,
  color: PFColors.Red100,
  textAlign: 'center',
  width: '100%'
});

export class ConditionList extends React.Component<Props> {
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
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <Thead>
            <Tr>
              <Th width={100}>Additional Conditions of a Request</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {this.props.conditionList.map((condition, i) => (
              <Tr key={`condition${i}`}>
                <Td>
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
                </Td>
                <Td />
              </Tr>
            ))}
          </Tbody>
        </Table>
        {this.props.conditionList.length === 0 && <div className={noConditionsStyle}>No Conditions Defined</div>}
      </>
    );
  }
}

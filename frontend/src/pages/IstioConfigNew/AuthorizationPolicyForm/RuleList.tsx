import * as React from 'react';
import { Rule } from './RuleBuilder';
import { Table, Tbody, Thead, Tr, Th, Td } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../components/Pf/PfColors';

type Props = {
  action: string;
  ruleList: Rule[];
  onRemoveRule: (index: number) => void;
};

const rulesPadding = kialiStyle({
  paddingLeft: 10
});

const noRulesStyle = kialiStyle({
  marginTop: 10,
  color: PFColors.Red100,
  textAlign: 'center',
  width: '100%'
});

export class RuleList extends React.Component<Props> {
  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove Rule',
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => {
        this.props.onRemoveRule(rowIndex);
      }
    };
    return [removeAction];
  };

  render() {
    const noRulesMessage =
      this.props.action === 'DENY' ? ' DENY action requires at least one Rule' : 'No Rules Defined.';
    return (
      <>
        <Table
          aria-label="Source Builder"
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <Thead>
            <Tr>
              <Th width={40}>From</Th>
              <Th width={40}>To</Th>
              <Th width={40}>When</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {this.props.ruleList.map((rule, i) => (
              <Tr key={`rule${i}`}>
                <Td>
                  {rule.from.length > 0 && (
                    <>
                      <>
                        {rule.from.map((fromItem, i) => {
                          const keys = Object.keys(fromItem);
                          return (
                            <div id={'from' + i} className={rulesPadding}>
                              <span style={{ marginRight: 20 }}>source:</span>
                              {keys.map((k, j) => {
                                return (
                                  <span id={'fromField' + i + '_' + j}>
                                    <b>{k}</b>: [{fromItem[k].join(',')}]{j < keys.length - 1 ? ' and ' : ''}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })}
                      </>
                    </>
                  )}
                </Td>
                <Td>
                  {rule.to.length > 0 && (
                    <>
                      {rule.to.map((toItem, i) => {
                        const keys = Object.keys(toItem);
                        return (
                          <div id={'to' + i} className={rulesPadding}>
                            <span style={{ marginRight: 20 }}>operation:</span>
                            {keys.map((k, j) => {
                              return (
                                <span id={'toItem' + i + '_' + j}>
                                  <b>{k}</b>: [{toItem[k].join(',')}]{j < keys.length - 1 ? ' and ' : ''}
                                </span>
                              );
                            })}
                          </div>
                        );
                      })}
                    </>
                  )}
                </Td>
                <Td>
                  {rule.when.length > 0 && (
                    <>
                      {rule.when.map((whenItem, i) => {
                        return (
                          <div id={'when' + i} className={rulesPadding}>
                            <span>
                              <b>key</b>: [{whenItem.key}]
                            </span>
                            <span style={{ marginLeft: 5 }}>
                              <b>values:</b> [{whenItem.values ? whenItem.values.join(',') : ''}]
                            </span>
                            <span style={{ marginLeft: 5 }}>
                              <b>notValues:</b> [{whenItem.notValues ? whenItem.notValues.join(',') : ''}]
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}
                </Td>
                <Td />
              </Tr>
            ))}
          </Tbody>
        </Table>
        {this.props.ruleList.length === 0 && <div className={noRulesStyle}>{noRulesMessage}</div>}
      </>
    );
  }
}

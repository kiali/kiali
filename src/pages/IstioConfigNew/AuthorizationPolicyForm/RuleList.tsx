import * as React from 'react';
import { Rule } from './RuleBuilder';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { style } from 'typestyle';
import { PfColors } from '../../../components/Pf/PfColors';

type Props = {
  ruleList: Rule[];
  onRemoveRule: (index: number) => void;
};

const headerCells: ICell[] = [
  {
    title: 'Rules to match the request',
    transforms: [cellWidth(100) as any],
    props: {}
  },
  {
    title: '',
    props: {}
  }
];

const rulesPadding = style({
  paddingLeft: 10
});

const noRulesStyle = style({
  color: PfColors.Red100,
  textAlign: 'center',
  width: '100%'
});

class RuleList extends React.Component<Props> {
  rows = () => {
    return this.props.ruleList.map((rule, i) => {
      return {
        key: 'rule' + i,
        cells: [
          <>
            {rule.from.length > 0 && (
              <>
                <b>From:</b>
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
            {rule.to.length > 0 && (
              <>
                <b>To:</b>
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
            {rule.when.length > 0 && (
              <>
                <b>When:</b>
                {rule.when.map((whenItem, i) => {
                  return (
                    <div id={'when' + i} className={rulesPadding}>
                      <span>
                        <b>key</b>: [{whenItem.key}]
                      </span>
                      <span style={{ marginLeft: 5 }}>
                        <b>values:</b> [{whenItem.values}]
                      </span>
                      <span style={{ marginLeft: 5 }}>
                        <b>notValues:</b> [{whenItem.notValues}]
                      </span>
                    </div>
                  );
                })}
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
      title: 'Remove Rule',
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => {
        this.props.onRemoveRule(rowIndex);
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
        {this.props.ruleList.length === 0 && <div className={noRulesStyle}>No Rules Defined</div>}
      </>
    );
  }
}

export default RuleList;

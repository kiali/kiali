import * as React from 'react';
import { Rule } from './RuleBuilder';
import { IRow, ThProps } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../components/Pf/PfColors';
import { SimpleTable } from 'components/Table/SimpleTable';
import { Button, ButtonVariant } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';

type RuleListProps = {
  action: string;
  onRemoveRule: (index: number) => void;
  ruleList: Rule[];
};

const columns: ThProps[] = [
  {
    title: 'From',
    width: 40
  },
  {
    title: 'To',
    width: 40
  },
  {
    title: 'When',
    width: 40
  },
  {
    title: ''
  }
];

const rulesStyle = kialiStyle({
  paddingLeft: '0.5rem'
});

const noRulesStyle = kialiStyle({
  color: PFColors.Red100,
  textAlign: 'center'
});

export const RuleList: React.FC<RuleListProps> = (props: RuleListProps) => {
  const rows: IRow[] = props.ruleList.map((rule, i) => {
    return {
      key: `rule_${i}`,
      cells: [
        <>
          {rule.from.length > 0 && (
            <>
              {rule.from.map((fromItem, i) => {
                const keys = Object.keys(fromItem);

                return (
                  <div id={`from_${i}`} className={rulesStyle}>
                    <span style={{ marginRight: '1.25rem' }}>source:</span>

                    {keys.map((k, j) => {
                      return (
                        <span id={`fromField_${i}_${j}`}>
                          <b>{k}</b>: [{fromItem[k].join(',')}]{j < keys.length - 1 ? ' and ' : ''}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </>,
        <>
          {rule.to.length > 0 && (
            <>
              {rule.to.map((toItem, i) => {
                const keys = Object.keys(toItem);

                return (
                  <div id={`to_${i}`} className={rulesStyle}>
                    <span style={{ marginRight: '1.25rem' }}>operation:</span>

                    {keys.map((k, j) => {
                      return (
                        <span id={`toItem_${i}_${j}`}>
                          <b>{k}</b>: [{toItem[k].join(',')}]{j < keys.length - 1 ? ' and ' : ''}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </>,
        <>
          {rule.when.length > 0 && (
            <>
              {rule.when.map((whenItem, i) => {
                return (
                  <div id={`when_${i}`} className={rulesStyle}>
                    <span>
                      <b>key</b>: [{whenItem.key}]
                    </span>

                    <span style={{ marginLeft: '0.25rem' }}>
                      <b>values:</b> [{whenItem.values ? whenItem.values.join(',') : ''}]
                    </span>

                    <span style={{ marginLeft: '0.25rem' }}>
                      <b>notValues:</b> [{whenItem.notValues ? whenItem.notValues.join(',') : ''}]
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </>,
        <Button
          id="removeRuleBtn"
          variant={ButtonVariant.link}
          icon={<KialiIcon.Delete />}
          onClick={() => props.onRemoveRule(i)}
        />
      ]
    };
  });

  const noRulesMessage = props.action === 'DENY' ? ' DENY action requires at least one Rule' : 'No Rules Defined.';

  const noRules = <div className={noRulesStyle}>{noRulesMessage}</div>;

  return <SimpleTable label="Rule List" columns={columns} rows={rows} emptyState={noRules} />;
};

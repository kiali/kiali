import * as React from 'react';
import { Condition } from './ConditionBuilder';
import { IRow, ThProps } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../../components/Pf/PfColors';
import { SimpleTable } from 'components/Table/SimpleTable';
import { Button, ButtonVariant } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';

type ConditionListProps = {
  conditionList: Condition[];
  onRemoveCondition: (index: number) => void;
};

const columns: ThProps[] = [
  {
    title: 'Additional Conditions of a Request',
    width: 100
  },
  {
    title: ''
  }
];

const noConditionsStyle = kialiStyle({
  color: PFColors.Red100,
  textAlign: 'center'
});

export const ConditionList: React.FC<ConditionListProps> = (props: ConditionListProps) => {
  const rows: IRow[] = props.conditionList.map((condition, i) => {
    return {
      key: `condition_${i}`,
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
        <Button
          id="removeConditionBtn"
          variant={ButtonVariant.link}
          icon={<KialiIcon.Delete />}
          onClick={() => props.onRemoveCondition(i)}
        />
      ]
    };
  });

  const noConditions = <div className={noConditionsStyle}>No Conditions Defined</div>;

  return <SimpleTable label="Condition List" columns={columns} rows={rows} emptyState={noConditions} />;
};

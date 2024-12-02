import * as React from 'react';
import { IRow, ThProps } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../../components/Pf/PfColors';
import { Button, ButtonVariant } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { SimpleTable } from 'components/Table/SimpleTable';
import { t, useKialiTranslation } from 'utils/I18nUtils';

type OperationListProps = {
  onRemoveTo: (index: number) => void;
  toList: { [key: string]: string[] }[];
};

const columns: ThProps[] = [
  {
    title: t('Operations of a Request'),
    width: 100
  },
  {
    title: ''
  }
];

const noOperationsStyle = kialiStyle({
  color: PFColors.Red100,
  textAlign: 'center'
});

export const OperationList: React.FC<OperationListProps> = (props: OperationListProps) => {
  const { t } = useKialiTranslation();

  const rows: IRow[] = props.toList.map((operation, i) => {
    return {
      key: `toOperation_${i}`,
      cells: [
        <>
          {Object.keys(operation).map((field, j) => {
            return (
              <div key={`operationField_${i}_${j}`}>
                <b>{field}</b>: [{operation[field].join(',')}]<br />
              </div>
            );
          })}
        </>,
        <Button
          id="removeToOperationBtn"
          variant={ButtonVariant.link}
          icon={<KialiIcon.Delete />}
          onClick={() => props.onRemoveTo(i)}
        />
      ]
    };
  });

  const noOperations = <div className={noOperationsStyle}>{t('No Operations Defined')}</div>;

  return <SimpleTable label={t('Operation List')} columns={columns} rows={rows} emptyState={noOperations} />;
};

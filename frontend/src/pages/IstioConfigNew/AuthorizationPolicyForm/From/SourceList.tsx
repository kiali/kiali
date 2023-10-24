import * as React from 'react';
import { ThProps } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../../components/Pf/PfColors';
import { SimpleTable } from 'components/SimpleTable';
import { Button, ButtonVariant } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';

type SourceListProps = {
  fromList: { [key: string]: string[] }[];
  onRemoveFrom: (index: number) => void;
};

const columns: ThProps[] = [
  {
    title: 'Source Matches of a Request',
    width: 100
  },
  {
    title: ''
  }
];

const noSourceStyle = kialiStyle({
  marginTop: '0.25rem',
  color: PFColors.Red100,
  textAlign: 'center'
});

export const SourceList: React.FC<SourceListProps> = (props: SourceListProps) => {
  const rows = props.fromList.map((source, i) => {
    return {
      key: `fromSource_${i}`,
      cells: [
        <>
          Rules
          {Object.keys(source).map((field, j) => {
            return (
              <div key={`sourceField_${field}_${i}_${j}`}>
                <b>{field}</b>: [{source[field].join(',')}]<br />
              </div>
            );
          })}
        </>,
        <Button
          id="removeFromSourceBtn"
          variant={ButtonVariant.link}
          icon={<KialiIcon.Delete />}
          onClick={() => props.onRemoveFrom(i)}
        />
      ]
    };
  });

  const emptyState = <div className={noSourceStyle}>No Source Matches Defined</div>;

  return <SimpleTable label="Source List" columns={columns} rows={rows} emptyState={emptyState} />;
};

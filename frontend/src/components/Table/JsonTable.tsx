import * as React from 'react';
import { IRow, ThProps } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { useKialiTranslation } from 'utils/I18nUtils';
import { SimpleTable } from './SimpleTable';
import { Json } from 'types/Common';

interface JsonTableProps {
  jsonData?: Json;
  label: string;
  width: string;
}

export const JsonTable: React.FC<JsonTableProps> = (props: JsonTableProps) => {
  const { t } = useKialiTranslation();

  if (!props.jsonData) {
    return null;
  }

  const tableStyle = kialiStyle({
    tableLayout: 'fixed',
    $nest: {
      '& tr > *:first-child': {
        width: props.width
      }
    }
  });

  const columns: ThProps[] = [{ title: t('Attribute') }, { title: t('Value') }];

  let rows: IRow[] = [];

  for (const [key, value] of Object.entries(props.jsonData)) {
    if (typeof value !== 'string') {
      rows.push({ cells: [key, <pre>{JSON.stringify(value, null, 2)}</pre>] });
    } else {
      rows.push({ cells: [key, value] });
    }
  }

  return <SimpleTable label={props.label} className={tableStyle} columns={columns} rows={rows} />;
};

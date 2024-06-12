import * as React from 'react';
import { IRow, ThProps } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { useKialiTranslation } from 'utils/I18nUtils';
import { SimpleTable } from './SimpleTable';
import { dump } from 'js-yaml';
import { yamlDumpOptions } from 'types/IstioConfigDetails';

interface ConfigTableProps {
  configData?: { [key: string]: string };
  label: string;
  width: string;
}

export const ConfigTable: React.FC<ConfigTableProps> = (props: ConfigTableProps) => {
  const { t } = useKialiTranslation();

  if (!props.configData) {
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

  for (const [key, value] of Object.entries(props.configData)) {
    if (typeof value !== 'string') {
      rows.push({ cells: [key, <pre>{dump(value, yamlDumpOptions)}</pre>] });
    } else {
      rows.push({ cells: [key, value] });
    }
  }

  return <SimpleTable label={props.label} className={tableStyle} columns={columns} rows={rows} />;
};

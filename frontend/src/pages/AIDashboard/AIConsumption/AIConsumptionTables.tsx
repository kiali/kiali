import * as React from 'react';
import { Grid, GridItem } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { ToolbarDropdown } from 'components/Dropdown/ToolbarDropdown';
import { PFSpacer } from 'styles/PfSpacer';
import { kialiStyle } from 'styles/StyleUtils';
import type { AITopModelRow, AITopUserRow, AIUsageResponse, UsageValueKind } from 'types/Chatbot';
import { TokensMillionsValue } from '../TokensMillionsValue';

const tablesToolbarStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  gap: PFSpacer.sm,
  justifyContent: 'flex-end',
  marginBottom: PFSpacer.md
});

const tableTitleStyle = kialiStyle({
  fontWeight: 'bold',
  marginBottom: PFSpacer.sm
});

const tableScrollStyle = kialiStyle({
  border: '1px solid var(--pf-t--global--border--color--default)',
  borderRadius: '4px',
  maxHeight: '200px',
  overflowY: 'auto'
});

const emptyStyle = kialiStyle({
  color: 'var(--pf-t--global--text--color--subtle)',
  fontStyle: 'italic',
  padding: PFSpacer.sm
});

const formatCost = (value: number, currency = 'USD'): string => {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
};

const generateTable = (
  summary: AITopModelRow[] | AITopUserRow[],
  columnNames: { name: string; value: string },
  title: string,
  valueKind: UsageValueKind
): React.ReactElement => {
  const getKey = (item: AITopModelRow | AITopUserRow): string => {
    if ('model' in item) {
      return `${item.provider}/${item.model}`;
    } else {
      return item.username;
    }
  };

  const getName = (item: AITopModelRow | AITopUserRow): string => {
    if ('model' in item) {
      return `${item.provider}/${item.model}`;
    } else {
      return item.username;
    }
  };

  const getValue = (item: AITopModelRow | AITopUserRow): React.ReactNode => {
    if (valueKind === 'cost') {
      const costVal = item.cost?.total || 0;
      const currency = item.cost?.currency || 'USD';
      return formatCost(costVal, currency);
    }
    return <TokensMillionsValue fromMillions value={item.totalTokens} />;
  };

  return (
    <Table aria-label={title} variant="compact">
      <Thead>
        <Tr>
          <Th>{columnNames.name}</Th>
          <Th>{columnNames.value}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {summary.map(item => {
          const key = getKey(item);
          return (
            <Tr key={key}>
              <Td dataLabel={columnNames.name}>{getName(item)}</Td>
              <Td dataLabel={columnNames.value}>{getValue(item)}</Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};

const LIMIT_OPTIONS = {
  '5': '5',
  '10': '10',
  '15': '15',
  '20': '20'
};

export const AIConsumptionTables: React.FC<{
  limit: number;
  onLimitChange: (limit: number) => void;
  summary: AIUsageResponse['topSummary'] | null;
  valueKind: UsageValueKind;
}> = ({ limit, onLimitChange, summary, valueKind }) => {
  const valueColumn = valueKind === 'cost' ? 'Cost' : 'Tokens (M)';
  const modelColumnNames = {
    name: 'Provider/Model',
    value: valueColumn
  };

  const usernameColumnNames = {
    name: 'Username',
    value: valueColumn
  };

  return (
    <div>
      <div className={tablesToolbarStyle}>
        <span>Show top:</span>
        <ToolbarDropdown
          id="ai-consumption-limit-dd"
          handleSelect={value => onLimitChange(parseInt(value, 10))}
          value={String(limit)}
          label={String(limit)}
          options={LIMIT_OPTIONS}
        />
      </div>
      <Grid hasGutter>
        <GridItem span={6}>
          <h4 className={tableTitleStyle}>Top {limit} Consumed Models</h4>
          <div className={tableScrollStyle}>
            {summary?.topModels && summary.topModels.length > 0 ? (
              generateTable(summary.topModels, modelColumnNames, 'AIConsumptionTablesForModels', valueKind)
            ) : (
              <p className={emptyStyle}>No model consumption</p>
            )}
          </div>
        </GridItem>
        <GridItem span={6}>
          <h4 className={tableTitleStyle}>Top {limit} Consumed Users</h4>
          <div className={tableScrollStyle}>
            {summary?.topUsers && summary.topUsers.length > 0 ? (
              generateTable(summary.topUsers, usernameColumnNames, 'AIConsumptionTablesForUsers', valueKind)
            ) : (
              <p className={emptyStyle}>No user consumption</p>
            )}
          </div>
        </GridItem>
      </Grid>
    </div>
  );
};

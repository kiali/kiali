import * as React from 'react';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IRow,
  TableVariant,
  IAction,
  ActionsColumn,
  IRowData,
  ISortBy,
  OnSort,
  ThProps
} from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';

export interface SortableTh extends ThProps {
  sortable: boolean;
}

interface SimpleTableProps {
  actionResolver?: (rowData: IRowData, rowIndex: number) => IAction[];
  className?: string;
  columns: SortableTh[] | ThProps[];
  emptyState?: React.ReactNode;
  label: string;
  onSort?: OnSort;
  rows: IRow[];
  sort?: (columnIndex: number) => ThProps['sort'];
  sortBy?: ISortBy;
  variant?: TableVariant;
  verticalAlign?: string;
}

export const SimpleTable: React.FC<SimpleTableProps> = (props: SimpleTableProps) => {
  const tdStyle = kialiStyle({
    verticalAlign: props.verticalAlign ?? 'baseline'
  });

  const getSortParams = (column: SortableTh | ThProps, index: number): ThProps['sort'] | undefined => {
    let thSort: ThProps['sort'] | undefined;

    if (props.onSort && props.sortBy) {
      thSort = (column as SortableTh).sortable
        ? {
            sortBy: props.sortBy,
            onSort: props.onSort,
            columnIndex: index
          }
        : undefined;
    }

    return thSort;
  };

  const getActionToggle = (row: IRow, rowIndex: number): React.ReactNode => {
    if (props.actionResolver) {
      const actionItems = props.actionResolver(row, rowIndex);

      if (actionItems.length > 0) {
        return (
          <Td className={tdStyle} isActionCell>
            <ActionsColumn items={actionItems} />
          </Td>
        );
      }
    }

    return undefined;
  };

  return (
    <Table aria-label={props.label} variant={props.variant} className={props.className}>
      <Thead>
        <Tr>
          {props.columns.map((column: SortableTh | ThProps, index: number) => (
            <Th
              key={column.key ?? `column_${index}`}
              dataLabel={column.title}
              width={column.width}
              sort={getSortParams(column, index)}
              info={column.info}
            >
              {column.title}
            </Th>
          ))}
        </Tr>
      </Thead>

      <Tbody>
        {props.rows.length > 0 ? (
          props.rows.map((row, rowIndex) => (
            <Tr key={row.key ?? `row_${rowIndex}`} className={row.className}>
              {row.cells?.map((cell: React.ReactNode, colIndex: number) => (
                <Td key={`cell_${rowIndex}_${colIndex}`} dataLabel={props.columns[colIndex].title} className={tdStyle}>
                  {cell}
                </Td>
              ))}

              {getActionToggle(row, rowIndex)}
            </Tr>
          ))
        ) : (
          <>
            {props.emptyState && (
              <Tr>
                <Td colSpan={props.columns.length}>{props.emptyState}</Td>
              </Tr>
            )}
          </>
        )}
      </Tbody>
    </Table>
  );
};

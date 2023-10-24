import * as React from 'react';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IRow,
  IRowCell,
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
}

const emptyStyle = kialiStyle({
  borderBottom: 0
});

export const SimpleTable: React.FC<SimpleTableProps> = (props: SimpleTableProps) => {
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

  const getActionToggle = (row: IRow, rowIndex: number) => {
    if (props.actionResolver) {
      const actionItems = props.actionResolver(row, rowIndex);

      if (actionItems.length > 0) {
        return (
          <Td isActionCell>
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
              {((row.cells as IRowCell[]) ?? row)?.map((cell, colIndex) => (
                <Td
                  key={cell.props?.key ?? `cell_${rowIndex}_${colIndex}`}
                  dataLabel={props.columns[colIndex].title}
                  colSpan={cell.props?.colSpan}
                >
                  {cell.title ?? cell}
                </Td>
              ))}
              {getActionToggle(row, rowIndex)}
            </Tr>
          ))
        ) : (
          <>
            {props.emptyState && (
              <Tr className={emptyStyle}>
                <Td colSpan={props.columns.length}>{props.emptyState}</Td>
              </Tr>
            )}
          </>
        )}
      </Tbody>
    </Table>
  );
};

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
  ThProps,
  InnerScrollContainer
} from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { isKiosk } from 'components/Kiosk/KioskActions';
import { store } from 'store/ConfigStore';

// TOP_PADDING constant is used to adjust the height of the main div to allow scrolling in the inner container layer.
const TOP_PADDING = 76 + 340;

// EMBEDDED_PADDING constant is a magic number used to adjust the height of the main div to allow scrolling in the inner container layer.
// 42px is the height of the first tab menu
const EMBEDDED_PADDING = 42 + 200;

export interface SortableTh extends ThProps {
  sortable: boolean;
}

interface SimpleTableProps {
  actionResolver?: (rowData: IRowData, rowIndex: number) => IAction[];
  className?: string;
  columns: SortableTh[] | ThProps[];
  emptyState?: React.ReactNode;
  isStickyHeader?: boolean;
  label: string;
  onSort?: OnSort;
  rows: IRow[];
  sort?: (columnIndex: number) => ThProps['sort'];
  sortBy?: ISortBy;    
  theadStyle?: React.CSSProperties;
  variant?: TableVariant;
  verticalAlign?: string;
}

export const SimpleTable: React.FC<SimpleTableProps> = (props: SimpleTableProps) => {
  const [heigth, setHeight] = React.useState('600px');

  const tdStyle = kialiStyle({
    verticalAlign: props.verticalAlign ?? 'baseline'
  });

  const updateWindowDimensions = (): void => {
    const isStandalone = !isKiosk(store.getState().globalState.kiosk);
    const topPadding = isStandalone ? TOP_PADDING : EMBEDDED_PADDING;
    setHeight(`${(window.innerHeight - topPadding).toString()}px`);
  };

  React.useEffect(() => {
    updateWindowDimensions();
    window.addEventListener('resize', updateWindowDimensions);
    return () => {
      window.removeEventListener('resize', updateWindowDimensions);
    };
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

  const table = (
    <Table aria-label={props.label} variant={props.variant} className={props.className} isStickyHeader={props.isStickyHeader}>
      <Thead style={props.theadStyle}>
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

  return !props.isStickyHeader ? (
    table
  ) : (
    <div style={{ height: heigth }}>
      <InnerScrollContainer style={{ maxHeight: '95%' }}>{table}</InnerScrollContainer>
    </div>
  );
};

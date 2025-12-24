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
const TOP_PADDING = 462;

// EMBEDDED_PADDING constant is a magic number used to adjust the height of the main div to allow scrolling in the inner container layer.
// 42px is the height of the first tab menu
const EMBEDDED_PADDING = 42 + 200;

/**
 * By default, Kiali hides the global scrollbar and fixes the height for some pages to force the scrollbar to appear
 * Hiding global scrollbar is not possible when Kiali is embedded in other application (like Openshift Console)
 * In these cases height is not fixed to avoid multiple scrollbars (https://github.com/kiali/kiali/issues/6601)
 * GLOBAL_SCROLLBAR environment variable is not defined in standalone Kiali application (value is always false)
 */
const globalScrollbar = process.env.GLOBAL_SCROLLBAR ?? 'false';

const innerScrollContainerStyle = kialiStyle({
  maxHeight: '95%',
  paddingRight: '0.5rem'
});

export interface SortableTh extends ThProps {
  headerContent?: React.ReactNode;
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
  const [scrollStyle, setScrollStyle] = React.useState('');

  const tdStyle = kialiStyle({
    verticalAlign: props.verticalAlign ?? 'baseline'
  });

  const updateWindowDimensions = (): void => {
    const isStandalone = !isKiosk(store.getState().globalState.kiosk);
    const topPadding = isStandalone ? TOP_PADDING : EMBEDDED_PADDING;
    setScrollStyle(getScrollStyle(window.innerHeight - topPadding));
  };

  React.useEffect(() => {
    updateWindowDimensions();
    window.addEventListener('resize', updateWindowDimensions);
    return () => {
      window.removeEventListener('resize', updateWindowDimensions);
    };
  });

  const getScrollStyle = (height: number): string => {
    if (globalScrollbar === 'false') {
      return kialiStyle({
        height: height,
        width: '100%'
      });
    }
    return kialiStyle({});
  };

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
    <Table
      aria-label={props.label}
      variant={props.variant}
      className={props.className}
      isStickyHeader={props.isStickyHeader}
    >
      <Thead style={props.theadStyle}>
        <Tr>
          {props.columns.map((column: SortableTh | ThProps, index: number) => (
            <Th
              key={column.key ?? `column_${index}`}
              dataLabel={column.title}
              width={column.width}
              sort={getSortParams(column, index)}
              info={column.info}
              className={column.className}
            >
              {'headerContent' in column ? column.headerContent ?? column.title : column.title}
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
    <div className={scrollStyle}>
      <InnerScrollContainer className={innerScrollContainerStyle}>{table}</InnerScrollContainer>
    </div>
  );
};

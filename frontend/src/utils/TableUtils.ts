import { ISortBy, OnSort, ThProps } from '@patternfly/react-table';

export type SortableTh<T> = ThProps & {
  compare?: (a: T, b: T) => number;
  sortable: boolean;
};

export const getSortParams = (
  column: SortableTh<any>,
  columnIndex: number,
  sortBy: ISortBy,
  onSort: OnSort
): ThProps['sort'] => {
  return column.sortable
    ? {
        sortBy: sortBy,
        onSort: onSort,
        columnIndex
      }
    : undefined;
};

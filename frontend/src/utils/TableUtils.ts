import { ISortBy, OnSort, ThProps } from '@patternfly/react-table';
import { ThSortType } from '@patternfly/react-table/dist/esm/components/Table/base/types';

export type SortableTh<T> = ThProps & {
  compare?: (a: T, b: T) => number;
  sortable: boolean;
};

export const getSortParams = <T>(
  column: SortableTh<T>,
  columnIndex: number,
  sortBy: ISortBy,
  onSort: OnSort
): ThSortType | undefined => {
  return column.sortable
    ? {
        sortBy: sortBy,
        onSort: onSort,
        columnIndex
      }
    : undefined;
};

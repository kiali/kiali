import * as React from 'react';
import { ICell, ISortBy, SortByDirection, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { ClusterSummaryTable, ClusterTable } from './ClusterTable';
import { RouteSummaryTable, RouteTable } from './RouteTable';
import { ListenerSummaryTable, ListenerTable } from './ListenerTable';
import { EnvoyProxyDump } from '../../../types/IstioObjects';
import { FilterSelected, StatefulFilters } from '../../Filters/StatefulFilters';
import { ActiveFilter, ActiveFiltersInfo, FilterType } from '../../../types/Filters';
import { setFiltersToURL } from '../../FilterList/FilterHelper';
import { ResourceSorts } from '../EnvoyModal';

export interface SummaryTable {
  head: () => ICell[];
  rows: () => (string | number)[][];
  resource: () => string;
  sortBy: () => ISortBy;
  setSorting: (columnIndex: number, direction: 'asc' | 'desc') => void;
  availableFilters: () => FilterType[];
}

export function SummaryTableRenderer<T extends SummaryTable>() {
  interface SummaryTableProps<T> {
    writer: T;
    sortBy: ISortBy;
    onSort: (resource: string, columnIndex: number, sortByDirection: SortByDirection) => void;
  }

  return class SummaryTable extends React.Component<SummaryTableProps<T>> {
    componentWillUnmount() {
      FilterSelected.resetFilters();
      setFiltersToURL(this.props.writer.availableFilters(), { filters: [], op: 'and' });
    }

    onSort = (_: React.MouseEvent, columnIndex: number, sortByDirection: SortByDirection) => {
      this.props.writer.setSorting(columnIndex, sortByDirection);
      this.props.onSort(this.props.writer.resource(), columnIndex, sortByDirection);
    };

    render() {
      return (
        <>
          <StatefulFilters initialFilters={this.props.writer.availableFilters()} onFilterChange={() => void {}} />
          <Table
            aria-label="Sortable Table"
            cells={this.props.writer.head()}
            rows={this.props.writer.rows()}
            sortBy={this.props.writer.sortBy()}
            onSort={this.onSort}
          >
            <TableHeader />
            <TableBody />
          </Table>
        </>
      );
    }
  };
}

export const SummaryTableBuilder = (resource: string, config: EnvoyProxyDump, sortBy: ResourceSorts) => {
  let writerComp, writerProps;

  switch (resource) {
    case 'clusters':
      writerComp = ClusterSummaryTable;
      writerProps = new ClusterTable(config.clusters || [], sortBy['clusters']);
      break;
    case 'listeners':
      writerComp = ListenerSummaryTable;
      writerProps = new ListenerTable(config.listeners || [], sortBy['listeners']);
      break;
    case 'routes':
      writerComp = RouteSummaryTable;
      writerProps = new RouteTable(config.routes || [], sortBy['routes']);
      break;
  }
  return [writerComp, writerProps];
};
export const defaultFilter = (value: (string | number)[], filterToColumn: { [id: string]: number }): boolean => {
  const activeFilters: ActiveFiltersInfo = FilterSelected.getSelected();
  // If there is no active filters, show the entry
  if (activeFilters.filters.length === 0) {
    return true;
  }

  // Group filters by id
  const groupedFilters: ActiveFilter[][] = activeFilters.filters.reduce(
    (groupedFilters: ActiveFilter[][], filter: ActiveFilter): ActiveFilter[][] => {
      let filterGroup = groupedFilters[filterToColumn[filter.id]];
      if (!filterGroup) {
        filterGroup = [];
      }
      groupedFilters[filterToColumn[filter.id]] = filterGroup.concat(filter);
      return groupedFilters;
    },
    []
  );

  // Show entities that has a match in each filter group
  return groupedFilters.reduce((prevMatch: boolean, filters: ActiveFilter[]): boolean => {
    // There is at least one filter matching the item in the group
    return (
      prevMatch &&
      filters.some((filter: ActiveFilter) => {
        const row: number = filterToColumn[filter.id];
        let match: boolean = true;
        if (row !== undefined) {
          match = value[row].toString().includes(filter.value);
        }
        return match;
      })
    );
  }, true);
};

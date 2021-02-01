import * as React from 'react';
import { ICell, ISortBy, SortByDirection, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { ClusterSummaryTable, ClusterTable } from './ClusterTable';
import { RouteSummaryTable, RouteTable } from './RouteTable';
import { ListenerSummaryTable, ListenerTable } from './ListenerTable';
import { EnvoyProxyDump } from '../../../types/IstioObjects';
import { ActiveFiltersInfo, FilterType } from '../../../types/Filters';
import { FilterSelected, StatefulFilters } from '../../Filters/StatefulFilters';
import { setFiltersToURL } from '../../FilterList/FilterHelper';
import { ResourceSorts } from '../EnvoyModal';
import Namespace from '../../../types/Namespace';

export interface SummaryTable {
  head: () => ICell[];
  rows: () => (string | number | JSX.Element)[][];
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

  type SummaryTableState = {
    activeFilters: ActiveFiltersInfo;
  };

  return class SummaryTable extends React.Component<SummaryTableProps<T>, SummaryTableState> {
    componentWillUnmount() {
      FilterSelected.resetFilters();
      setFiltersToURL(this.props.writer.availableFilters(), { filters: [], op: 'and' });
    }

    onSort = (_: React.MouseEvent, columnIndex: number, sortByDirection: SortByDirection) => {
      this.props.writer.setSorting(columnIndex, sortByDirection);
      this.props.onSort(this.props.writer.resource(), columnIndex, sortByDirection);
    };

    onFilterApplied = (activeFilter: ActiveFiltersInfo) => {
      this.setState({
        activeFilters: activeFilter
      });
    };

    render() {
      return (
        <>
          <StatefulFilters
            initialFilters={this.props.writer.availableFilters()}
            onFilterChange={this.onFilterApplied}
          />
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

export const SummaryTableBuilder = (
  resource: string,
  config: EnvoyProxyDump,
  sortBy: ResourceSorts,
  namespaces: Namespace[],
  namespace: string
) => {
  let writerComp, writerProps;

  switch (resource) {
    case 'clusters':
      writerComp = ClusterSummaryTable;
      writerProps = new ClusterTable(config.clusters || [], sortBy['clusters'], namespaces, namespace);
      break;
    case 'listeners':
      writerComp = ListenerSummaryTable;
      writerProps = new ListenerTable(config.listeners || [], sortBy['listeners'], namespaces);
      break;
    case 'routes':
      writerComp = RouteSummaryTable;
      writerProps = new RouteTable(config.routes || [], sortBy['routes'], namespaces, namespace);
      break;
  }
  return [writerComp, writerProps];
};

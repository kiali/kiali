import * as React from 'react';
import { ICell, ISortBy, SortByDirection } from '@patternfly/react-table';
import { Table, TableBody, TableHeader } from '@patternfly/react-table/deprecated';
import { ClusterSummaryTable, ClusterTable } from './ClusterTable';
import { RouteSummaryTable, RouteTable } from './RouteTable';
import { ListenerSummaryTable, ListenerTable } from './ListenerTable';
import { EnvoyProxyDump } from '../../../types/IstioObjects';
import { ActiveFiltersInfo, FilterType } from '../../../types/Filters';
import { StatefulFilters } from '../../Filters/StatefulFilters';
import { ResourceSorts } from '../EnvoyDetails';
import { Namespace } from '../../../types/Namespace';
import { ToolbarDropdown } from '../../ToolbarDropdown/ToolbarDropdown';
import { PFBadge, PFBadges } from '../../Pf/PfBadges';
import { TooltipPosition } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';

export interface SummaryTable {
  head: () => ICell[];
  rows: () => (string | number | JSX.Element)[][];
  resource: () => string;
  sortBy: () => ISortBy;
  setSorting: (columnIndex: number, direction: 'asc' | 'desc') => void;
  availableFilters: () => FilterType[];
  tooltip: () => React.ReactNode;
}

const iconStyle = kialiStyle({
  display: 'inline-block'
});

export function SummaryTableRenderer<T extends SummaryTable>() {
  interface SummaryTableProps<T> {
    writer: T;
    sortBy: ISortBy;
    onSort: (resource: string, columnIndex: number, sortByDirection: SortByDirection) => void;
    pod: string;
    pods: string[];
    setPod: (pod: string) => void;
  }

  type SummaryTableState = {
    activeFilters: ActiveFiltersInfo;
  };

  return class SummaryTable extends React.Component<SummaryTableProps<T>, SummaryTableState> {
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
            childrenFirst={true}
          >
            <>
              <div key="service-icon" className={iconStyle}>
                <PFBadge badge={PFBadges.Pod} position={TooltipPosition.top} />
              </div>
              <ToolbarDropdown
                id="envoy_pods_list"
                tooltip={$t('tip214', 'Display envoy config for the selected pod')}
                handleSelect={key => this.props.setPod(key)}
                value={this.props.pod}
                label={$t(this.props.pod)}
                options={this.props.pods.sort()}
              />
              <div className={kialiStyle({ position: 'absolute', right: '60px' })}>{this.props.writer.tooltip()}</div>
            </>
          </StatefulFilters>
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
  namespace: string,
  routeLinkHandler: () => void,
  kiosk: string,
  workload?: string
) => {
  let writerComp, writerProps;

  switch (resource) {
    case 'clusters':
      writerComp = ClusterSummaryTable;
      writerProps = new ClusterTable(config.clusters || [], sortBy['clusters'], namespaces, namespace, kiosk);
      break;
    case 'listeners':
      writerComp = ListenerSummaryTable;
      writerProps = new ListenerTable(
        config.listeners || [],
        sortBy['listeners'],
        namespaces,
        namespace,
        workload,
        routeLinkHandler
      );
      break;
    case 'routes':
      writerComp = RouteSummaryTable;
      writerProps = new RouteTable(config.routes || [], sortBy['routes'], namespaces, namespace, kiosk);
      break;
  }
  return [writerComp, writerProps];
};

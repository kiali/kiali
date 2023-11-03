import * as React from 'react';
import { SummaryTable, SummaryTableRenderer } from './BaseTable';
import { IRow, ISortBy } from '@patternfly/react-table';
import { ListenerSummary } from '../../../types/IstioObjects';
import { ActiveFilter, FILTER_ACTION_APPEND, FilterType, AllFilterTypes } from '../../../types/Filters';
import { SortField } from '../../../types/SortFilters';
import { Namespace } from '../../../types/Namespace';
import { defaultFilter, routeLink } from '../../../helpers/EnvoyHelpers';
import { Tooltip } from '@patternfly/react-core';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { SortableTh } from 'components/SimpleTable';

export class ListenerTable implements SummaryTable {
  namespace: string;
  namespaces: Namespace[];
  routeLinkHandler: () => void;
  sortingDirection: 'asc' | 'desc';
  sortingIndex: number;
  summaries: ListenerSummary[];
  workload: string | undefined;

  constructor(
    summaries: ListenerSummary[],
    sortBy: ISortBy,
    namespaces: Namespace[],
    namespace: string,
    workload: string | undefined,
    routeLinkHandler: () => void
  ) {
    this.summaries = summaries;
    this.sortingIndex = sortBy.index ?? 0;
    this.sortingDirection = sortBy.direction ?? 'asc';
    this.namespaces = namespaces;
    this.namespace = namespace;
    this.workload = workload;
    this.routeLinkHandler = routeLinkHandler;
  }

  availableFilters = (): FilterType[] => {
    return [
      {
        category: 'Address',
        placeholder: 'Address',
        filterType: AllFilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      },
      {
        category: 'Port',
        placeholder: 'Port',
        filterType: AllFilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      },
      {
        category: 'Match',
        placeholder: 'Match',
        filterType: AllFilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      },
      {
        category: 'Destination',
        placeholder: 'Destination',
        filterType: AllFilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      }
    ];
  };

  filterMethods = (): { [filter_id: string]: (entry: ListenerSummary, filter: ActiveFilter) => boolean } => {
    return {
      Address: (entry: ListenerSummary, filter: ActiveFilter): boolean => {
        return entry.address.includes(filter.value);
      },
      Port: (entry: ListenerSummary, filter: ActiveFilter): boolean => {
        return entry.port.toString().includes(filter.value);
      },
      Match: (entry: ListenerSummary, filter: ActiveFilter): boolean => {
        return entry.match.includes(filter.value);
      },
      Destination: (entry: ListenerSummary, filter: ActiveFilter): boolean => {
        return entry.destination.includes(filter.value);
      }
    };
  };

  sortFields = (): SortField<ListenerSummary>[] => {
    return [
      {
        id: 'address',
        title: 'Address',
        isNumeric: false,
        param: 'addess',
        compare: (a, b) => {
          return a.address.localeCompare(b.address);
        }
      },
      {
        id: 'port',
        title: 'Port',
        isNumeric: true,
        param: 'port',
        compare: (a, b) => {
          return a.port - b.port;
        }
      },
      {
        id: 'match',
        title: 'Match',
        isNumeric: false,
        param: 'match',
        compare: (a, b) => {
          return a.match.localeCompare(b.match);
        }
      },
      {
        id: 'destination',
        title: 'Destination',
        isNumeric: false,
        param: 'destination',
        compare: (a, b) => {
          return a.destination.localeCompare(b.destination);
        }
      }
    ];
  };

  head = (): SortableTh[] => {
    return [
      {
        title: 'Address',
        sortable: true,
        info: {
          tooltip: (
            <div className={kialiStyle({ textAlign: 'left' })}>
              The address that the listener should listen on. In general, the address must be unique, though that is
              governed by the bind rules of the OS
            </div>
          )
        }
      },
      {
        title: 'Port',
        sortable: true
      },
      {
        title: 'Match',
        sortable: true
      },
      {
        title: 'Destination',
        sortable: true,
        info: {
          tooltip: (
            <div className={kialiStyle({ textAlign: 'left' })}>
              Original destination listener filter reads the SO_ORIGINAL_DST socket option set when a connection has
              been redirected by an iptables REDIRECT target, or by an iptables TPROXY target in combination with
              setting the listener’s transparent option
            </div>
          )
        }
      }
    ];
  };

  resource = (): string => 'listeners';

  setSorting = (columnIndex: number, direction: 'asc' | 'desc'): void => {
    this.sortingDirection = direction;
    this.sortingIndex = columnIndex;
  };

  sortBy = (): ISortBy => {
    return {
      index: this.sortingIndex,
      direction: this.sortingDirection
    };
  };

  tooltip = (): React.ReactNode => {
    return (
      <Tooltip
        content={
          <div className={kialiStyle({ textAlign: 'left' })}>
            Network location that can be connected to by downstream clients (Incomming to envoy). List of
            endpoints:ports that envoy lets traffic
          </div>
        }
      >
        <KialiIcon.Help className={kialiStyle({ width: '14px', height: '14px', color: PFColors.Info })} />
      </Tooltip>
    );
  };

  rows(): IRow[] {
    return this.summaries
      .filter((value: ListenerSummary) => {
        return defaultFilter(value, this.filterMethods());
      })
      .sort((a: ListenerSummary, b: ListenerSummary) => {
        const sortField = this.sortFields().find((value: SortField<ListenerSummary>): boolean => {
          return value.id === this.sortFields()[this.sortingIndex].id;
        });

        return this.sortingDirection === 'asc' ? sortField!.compare(a, b) : sortField!.compare(b, a);
      })
      .map(
        (summary: ListenerSummary): IRow => {
          return {
            cells: [
              summary.address,
              summary.port,
              summary.match,
              routeLink(summary.destination, this.namespace, this.workload, this.routeLinkHandler)
            ]
          };
        }
      );
  }
}

export const ListenerSummaryTable = SummaryTableRenderer<ListenerTable>();

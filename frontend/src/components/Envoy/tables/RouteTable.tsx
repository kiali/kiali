import * as React from 'react';
import { SummaryTable, SummaryTableRenderer } from './BaseTable';
import { IRow, ISortBy } from '@patternfly/react-table';
import { RouteSummary } from '../../../types/IstioObjects';
import { ActiveFilter, FILTER_ACTION_APPEND, FilterType, AllFilterTypes } from '../../../types/Filters';
import { SortField } from '../../../types/SortFilters';
import { Namespace } from '../../../types/Namespace';
import { defaultFilter, istioConfigLink, serviceLink } from '../../../helpers/EnvoyHelpers';
import { Tooltip } from '@patternfly/react-core';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { isParentKiosk } from '../../Kiosk/KioskActions';
import { SortableTh } from 'components/Table/SimpleTable';
import { dicTypeToGVK, gvkType } from '../../../types/IstioConfigList';

export class RouteTable implements SummaryTable {
  kiosk: string;
  namespace: string;
  namespaces: Namespace[];
  sortingDirection: 'asc' | 'desc';
  sortingIndex: number;
  summaries: RouteSummary[];

  constructor(summaries: RouteSummary[], sortBy: ISortBy, namespaces: Namespace[], namespace: string, kiosk: string) {
    this.summaries = summaries;
    this.sortingIndex = sortBy.index ?? 0;
    this.sortingDirection = sortBy.direction ?? 'asc';
    this.namespaces = namespaces;
    this.namespace = namespace;
    this.kiosk = kiosk;
  }

  availableFilters = (): FilterType[] => {
    return [
      {
        category: 'Name',
        placeholder: 'Name',
        filterType: AllFilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      },
      {
        category: 'Domains',
        placeholder: 'Domains',
        filterType: AllFilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      }
    ];
  };

  filterMethods = (): { [filter_id: string]: (entry: RouteSummary, filter: ActiveFilter) => boolean } => {
    return {
      Name: (entry: RouteSummary, filter: ActiveFilter): boolean => {
        return entry.name.toString().includes(filter.value);
      },
      Domains: (entry: RouteSummary, filter: ActiveFilter): boolean => {
        return [entry.domains.service, entry.domains.namespace, entry.domains.cluster].join('.').includes(filter.value);
      }
    };
  };

  sortFields = (): SortField<RouteSummary>[] => {
    return [
      {
        id: 'name',
        title: 'Name',
        isNumeric: false,
        param: 'name',
        compare: (a, b) => {
          return a.name.localeCompare(b.name);
        }
      },
      {
        id: 'domains',
        title: 'Domains',
        isNumeric: false,
        param: 'doms',
        compare: (a, b) => {
          return [a.domains.service, a.domains.namespace, a.domains.cluster]
            .join('.')
            .localeCompare([b.domains.service, b.domains.namespace, b.domains.cluster].join('.'));
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
        id: 'vs',
        title: 'Virtual Service',
        isNumeric: false,
        param: 'vs',
        compare: (a, b) => {
          return a.virtual_service.localeCompare(b.virtual_service);
        }
      }
    ];
  };

  head(): SortableTh[] {
    return [
      {
        title: 'Name',
        sortable: true
      },
      {
        title: 'Domains',
        sortable: true,
        info: {
          tooltip: (
            <div className={kialiStyle({ textAlign: 'left' })}>
              Envoy will be matched this domain to this virtual host.
            </div>
          )
        }
      },
      {
        title: 'Match',
        sortable: true,
        info: {
          tooltip: (
            <div className={kialiStyle({ textAlign: 'left' })}>
              The match tree to use when resolving route actions for incoming requests
            </div>
          )
        }
      },
      {
        title: 'Virtual Service',
        sortable: true
      }
    ];
  }

  resource = (): string => 'routes';

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
            Network connection between source a destination that is configured in envoy
          </div>
        }
      >
        <KialiIcon.Help className={kialiStyle({ width: '14px', height: '14px', color: PFColors.Info })} />
      </Tooltip>
    );
  };

  rows(): IRow[] {
    const parentKiosk = isParentKiosk(this.kiosk);
    return this.summaries
      .filter((value: RouteSummary) => {
        return defaultFilter(value, this.filterMethods());
      })
      .sort((a: RouteSummary, b: RouteSummary) => {
        const sortField = this.sortFields().find((value: SortField<RouteSummary>): boolean => {
          return value.id === this.sortFields()[this.sortingIndex].id;
        });

        return this.sortingDirection === 'asc' ? sortField!.compare(a, b) : sortField!.compare(b, a);
      })
      .map(
        (summary: RouteSummary): IRow => {
          return {
            cells: [
              summary.name,
              serviceLink(summary.domains, this.namespaces, this.namespace, true, parentKiosk),
              summary.match,
              istioConfigLink(summary.virtual_service, dicTypeToGVK[gvkType.VirtualService])
            ]
          };
        }
      );
  }
}

export const RouteSummaryTable = SummaryTableRenderer<RouteTable>();

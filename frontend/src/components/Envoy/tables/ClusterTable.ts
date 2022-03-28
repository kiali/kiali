import { SummaryTable, SummaryTableRenderer } from './BaseTable';
import { ICell, ISortBy, sortable, SortByDirection } from '@patternfly/react-table';
import { ClusterSummary } from '../../../types/IstioObjects';
import { ActiveFilter, FILTER_ACTION_APPEND, FilterType, AllFilterTypes } from '../../../types/Filters';
import { SortField } from '../../../types/SortFilters';
import Namespace from '../../../types/Namespace';
import { defaultFilter, istioConfigLink, serviceLink } from '../../../helpers/EnvoyHelpers';

export class ClusterTable implements SummaryTable {
  summaries: ClusterSummary[];
  sortingIndex: number;
  sortingDirection: 'asc' | 'desc';
  namespaces: Namespace[] | undefined;
  namespace: string;

  constructor(summaries: ClusterSummary[], sortBy: ISortBy, namespaces: Namespace[], namespace: string) {
    this.summaries = summaries;
    this.sortingIndex = sortBy.index || 0;
    this.sortingDirection = sortBy.direction || SortByDirection.asc;
    this.namespaces = namespaces;
    this.namespace = namespace;
  }

  availableFilters = (): FilterType[] => {
    return [
      {
        id: 'fqdn',
        title: 'FQDN',
        placeholder: 'FQDN',
        filterType: AllFilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      },
      {
        id: 'port',
        title: 'Port',
        placeholder: 'Port',
        filterType: AllFilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      },
      {
        id: 'subset',
        title: 'Subset',
        placeholder: 'Subset',
        filterType: AllFilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      },
      {
        id: 'direction',
        title: 'Direction',
        placeholder: 'Direction',
        filterType: AllFilterTypes.select,
        action: FILTER_ACTION_APPEND,
        filterValues: [
          { id: 'inbound', title: 'inbound' },
          { id: 'outbound', title: 'outbound' }
        ]
      }
    ];
  };

  filterMethods = (): { [filter_id: string]: (ClusterSummary, ActiveFilter) => boolean } => {
    return {
      fqdn: (entry: ClusterSummary, filter: ActiveFilter): boolean => {
        return [entry.service_fqdn.service, entry.service_fqdn.namespace, entry.service_fqdn.cluster]
          .join('.')
          .includes(filter.value);
      },
      port: (entry: ClusterSummary, filter: ActiveFilter): boolean => {
        return entry.port.toString().includes(filter.value);
      },
      subset: (entry: ClusterSummary, filter: ActiveFilter): boolean => {
        return entry.subset.toString().includes(filter.value);
      },
      direction: (entry: ClusterSummary, filter: ActiveFilter): boolean => {
        return entry.direction.toString().includes(filter.value);
      }
    };
  };

  sortFields = (): SortField<ClusterSummary>[] => {
    return [
      {
        id: 'fqdn',
        title: 'FQDN',
        isNumeric: false,
        param: 'fqdn',
        compare: (a, b) => {
          return [a.service_fqdn.service, a.service_fqdn.namespace, a.service_fqdn.cluster]
            .join('.')
            .localeCompare([b.service_fqdn.service, b.service_fqdn.namespace, b.service_fqdn.cluster].join('.'));
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
        id: 'subset',
        title: 'Subset',
        isNumeric: false,
        param: 'subset',
        compare: (a, b) => {
          return a.subset.localeCompare(b.subset);
        }
      },
      {
        id: 'direction',
        title: 'Direction',
        isNumeric: false,
        param: 'direction',
        compare: (a, b) => {
          return a.direction.localeCompare(b.direction);
        }
      },
      {
        id: 'type',
        title: 'Type',
        isNumeric: true,
        param: 'type',
        compare: (a, b) => {
          return a.type - b.type;
        }
      },
      {
        id: 'dr',
        title: 'Destination Rule',
        isNumeric: true,
        param: 'dr',
        compare: (a, b) => {
          return a.destination_rule.localeCompare(b.destination_rule);
        }
      }
    ];
  };

  head = (): ICell[] => {
    return [
      { title: 'Service FQDN', transforms: [sortable] },
      { title: 'Port', transforms: [sortable] },
      { title: 'Subset', transforms: [sortable] },
      { title: 'Direction', transforms: [sortable] },
      { title: 'Type', transforms: [sortable] },
      { title: 'DestinationRule', transforms: [sortable] }
    ];
  };

  resource = (): string => 'clusters';

  setSorting = (columnIndex: number, direction: 'asc' | 'desc') => {
    this.sortingIndex = columnIndex;
    this.sortingDirection = direction;
  };

  sortBy = (): ISortBy => {
    return {
      index: this.sortingIndex,
      direction: this.sortingDirection || 'asc'
    };
  };

  rows(): (string | number | JSX.Element)[][] {
    return this.summaries
      .filter((value: ClusterSummary): boolean => {
        return defaultFilter(value, this.filterMethods());
      })
      .sort((a: ClusterSummary, b: ClusterSummary): number => {
        const sortField = this.sortFields().find((value: SortField<ClusterSummary>): boolean => {
          return value.id === this.sortFields()[this.sortingIndex].id;
        });
        return this.sortingDirection === 'asc' ? sortField!.compare(a, b) : sortField!.compare(b, a);
      })
      .map((value: ClusterSummary): (string | number | JSX.Element)[] => {
        return [
          serviceLink(value.service_fqdn, this.namespaces, this.namespace),
          value.port,
          value.subset,
          value.direction,
          value.type,
          istioConfigLink(value.destination_rule, 'destinationrule')
        ];
      });
  }
}

export const ClusterSummaryTable = SummaryTableRenderer<ClusterTable>();

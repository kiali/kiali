import { defaultFilter, SummaryTable, SummaryTableRenderer } from './BaseTable';
import { ICell, ISortBy, sortable, SortByDirection } from '@patternfly/react-table';
import { ClusterSummary } from '../../../types/IstioObjects';
import { FILTER_ACTION_APPEND, FilterType, FilterTypes } from '../../../types/Filters';

const filterToColumn = {
  fqdn: 0,
  port: 1,
  subset: 2,
  direction: 3
};

export class ClusterTable implements SummaryTable {
  summaries: ClusterSummary[];
  sortingIndex: number;
  sortingDirection: 'asc' | 'desc';

  constructor(summaries: ClusterSummary[], sortBy: ISortBy) {
    this.summaries = summaries;
    this.sortingIndex = sortBy.index || 0;
    this.sortingDirection = sortBy.direction || SortByDirection.asc;
  }

  availableFilters = (): FilterType[] => {
    return [
      {
        id: 'fqdn',
        title: 'FQDN',
        placeholder: 'FQDN',
        filterType: FilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      },
      {
        id: 'port',
        title: 'Port',
        placeholder: 'Port',
        filterType: FilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      },
      {
        id: 'subset',
        title: 'Subset',
        placeholder: 'Subset',
        filterType: FilterTypes.text,
        action: FILTER_ACTION_APPEND,
        filterValues: []
      },
      {
        id: 'direction',
        title: 'Direction',
        placeholder: 'Direction',
        filterType: FilterTypes.select,
        action: FILTER_ACTION_APPEND,
        filterValues: [
          { id: 'inbound', title: 'inbound' },
          { id: 'outbound', title: 'outbound' }
        ]
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

  rows(): (string | number)[][] {
    return this.summaries
      .map((summary: ClusterSummary): (string | number)[] => {
        return [
          summary.service_fqdn,
          summary.port || '-',
          summary.subset || '-',
          summary.direction || '-',
          summary.type,
          summary.destination_rule
        ];
      })
      .filter((value: (string | number)[]) => {
        return defaultFilter(value, filterToColumn);
      })
      .sort((a: any[], b: any[]) => {
        if (this.sortingDirection === 'asc') {
          return a[this.sortingIndex] < b[this.sortingIndex] ? -1 : a[this.sortingIndex] > b[this.sortingIndex] ? 1 : 0;
        } else {
          return a[this.sortingIndex] > b[this.sortingIndex] ? -1 : a[this.sortingIndex] < b[this.sortingIndex] ? 1 : 0;
        }
      });
  }
}

export const ClusterSummaryTable = SummaryTableRenderer<ClusterTable>();

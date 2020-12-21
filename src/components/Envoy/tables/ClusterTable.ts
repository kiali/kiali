import { SummaryTable, SummaryTableRenderer } from './BaseTable';
import { ICell, sortable } from '@patternfly/react-table';
import { ClusterSummary } from '../../../types/IstioObjects';

export class ClusterTable implements SummaryTable {
  summaries: ClusterSummary[];
  sortingIndex: number;
  sortingDirection: string;

  constructor(summaries: ClusterSummary[]) {
    this.summaries = summaries;
    this.sortingIndex = 0;
    this.sortingDirection = 'asc';
  }

  setSorting = (columnIndex: number, direction: string) => {
    this.sortingDirection = direction;
    this.sortingIndex = columnIndex;
  };

  head(): ICell[] {
    return [
      { title: 'Service FQDN', transforms: [sortable] },
      { title: 'Port', transforms: [sortable] },
      { title: 'Subset', transforms: [sortable] },
      { title: 'Direction', transforms: [sortable] },
      { title: 'Type', transforms: [sortable] },
      { title: 'DestinationRule', transforms: [sortable] }
    ];
  }

  rows(): (string | number)[][] {
    return this.summaries
      .map((summary: ClusterSummary) => {
        return [
          summary.service_fqdn,
          summary.port || '-',
          summary.subset || '-',
          summary.direction || '-',
          summary.type,
          summary.destination_rule
        ];
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

import { SummaryTable, SummaryTableRenderer } from './BaseTable';
import { ICell, sortable } from '@patternfly/react-table';
import { RouteSummary } from '../../../types/IstioObjects';

export class RouteTable implements SummaryTable {
  summaries: RouteSummary[];
  sortingIndex: number;
  sortingDirection: string;

  constructor(summaries: RouteSummary[]) {
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
      { title: 'Name', transforms: [sortable] },
      { title: 'Domains', transforms: [sortable] },
      { title: 'Match', transforms: [sortable] },
      { title: 'Virtual Service', transforms: [sortable] }
    ];
  }

  rows(): string[][] {
    return this.summaries
      .map((summary: RouteSummary) => {
        return [summary.name, summary.domains, summary.match, summary.virtual_service];
      })
      .sort((a: string[], b: string[]) => {
        if (this.sortingDirection === 'asc') {
          return a[this.sortingIndex] < b[this.sortingIndex] ? -1 : a[this.sortingIndex] > b[this.sortingIndex] ? 1 : 0;
        } else {
          return a[this.sortingIndex] > b[this.sortingIndex] ? -1 : a[this.sortingIndex] < b[this.sortingIndex] ? 1 : 0;
        }
      });
  }
}

export const RouteSummaryTable = SummaryTableRenderer<RouteTable>();

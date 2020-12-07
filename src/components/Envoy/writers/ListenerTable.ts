import { SummaryTable, SummaryTableRenderer } from './BaseTable';
import { ICell, sortable } from '@patternfly/react-table';
import { ListenerSummary } from '../../../types/IstioObjects';

export class ListenerTable implements SummaryTable {
  summaries: ListenerSummary[];
  sortingIndex: number;
  sortingDirection: string;

  constructor(summaries: ListenerSummary[]) {
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
      { title: 'Address', transforms: [sortable] },
      { title: 'Port', transforms: [sortable] },
      { title: 'Match', transforms: [sortable] },
      { title: 'Destination', transforms: [sortable] }
    ];
  }

  rows(): (string | number)[][] {
    return this.summaries
      .map((summary: ListenerSummary) => {
        return [summary.address, summary.port, summary.match, summary.destination];
      })
      .sort((a: (string | number)[], b: (string | number)[]) => {
        if (this.sortingDirection === 'asc') {
          return a[this.sortingIndex] < b[this.sortingIndex] ? -1 : a[this.sortingIndex] > b[this.sortingIndex] ? 1 : 0;
        } else {
          return a[this.sortingIndex] > b[this.sortingIndex] ? -1 : a[this.sortingIndex] < b[this.sortingIndex] ? 1 : 0;
        }
      });
  }
}

export const ListenerSummaryTable = SummaryTableRenderer<ListenerTable>();

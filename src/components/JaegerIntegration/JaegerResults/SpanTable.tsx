import * as React from 'react';
import { EmptyState, EmptyStateBody, EmptyStateVariant, Title } from '@patternfly/react-core';
import {
  Table,
  TableHeader,
  TableBody,
  TableVariant,
  RowWrapper,
  sortable,
  SortByDirection,
  ICell,
  cellWidth
} from '@patternfly/react-table';

import { addError, addInfo } from 'utils/AlertUtils';
import { buildRow, SpanItemData } from './SpanTableItem';
import { compareNullable } from 'components/FilterList/FilterHelper';
import { MetricsStats } from 'types/Metrics';
import { fetchStats } from './StatsComparison';

type SortableCell<T> = ICell & {
  compare?: (a: T, b: T) => number;
};

interface Props {
  items: SpanItemData[];
  namespace: string;
  externalURL?: string;
}

interface State {
  toggledLinks?: string;
  sortIndex: number;
  sortDirection: SortByDirection;
  metricsStats: { [key: string]: MetricsStats };
}

export class SpanTable extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { sortIndex: 0, sortDirection: SortByDirection.asc, metricsStats: {} };
  }

  componentDidMount() {
    // Load stats for first 10 spans, to avoid heavy loading. More stats can be loaded individually.
    this.fetchComparisonMetrics(this.props.items.filter(s => s.type === 'envoy').slice(0, 10));
  }

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>) {
    if (prevState.toggledLinks) {
      this.setState({ toggledLinks: undefined });
    }
    if (this.props.items !== prevProps.items) {
      this.setState({ metricsStats: {} });
      // Load stats for first 10 spans, to avoid heavy loading. More stats can be loaded individually.
      this.fetchComparisonMetrics(this.props.items.filter(s => s.type === 'envoy').slice(0, 10));
    }
  }

  private fetchComparisonMetrics(items: SpanItemData[]) {
    fetchStats(items)
      .then(res => {
        // Merge stats
        const merged = { ...this.state.metricsStats, ...res.data.stats };
        this.setState({ metricsStats: merged });
        if (res.data.warnings && res.data.warnings.length > 0) {
          addInfo(res.data.warnings.join('; '), false);
        }
      })
      .catch(err => {
        addError('Could not fetch metrics stats.', err);
      });
  }

  private cells = (): SortableCell<SpanItemData>[] => {
    return [
      {
        title: 'Timeline',
        transforms: [sortable, cellWidth('5%')],
        compare: (a, b) => a.startTime - b.startTime
      },
      {
        title: 'App / Workload',
        transforms: [sortable, cellWidth('20%')],
        compare: (a, b) => compareNullable(a.workload, b.workload, (a2, b2) => a2.localeCompare(b2))
      },
      {
        title: 'Summary',
        transforms: [cellWidth('50%')]
      },
      {
        title: 'Statistics',
        transforms: [sortable, cellWidth('20%')],
        compare: (a, b) => a.duration - b.duration
      },
      {
        title: '', // Links
        transforms: [cellWidth('5%')]
      }
    ];
  };

  private rows = (cells: SortableCell<SpanItemData>[]) => {
    const compare = cells[this.state.sortIndex].compare;
    const sorted = compare
      ? this.props.items.sort(this.state.sortDirection === SortByDirection.asc ? compare : (a, b) => compare(b, a))
      : this.props.items;
    return sorted.map(item =>
      buildRow({
        externalURL: this.props.externalURL,
        toggledLinks: this.state.toggledLinks,
        setToggledLinks: key => this.setState({ toggledLinks: key }),
        onClickFetchStats: () => this.fetchComparisonMetrics([item]),
        metricsStats: this.state.metricsStats,
        ...item
      })
    );
  };

  render() {
    const cells = this.cells();
    return (
      <Table
        variant={TableVariant.compact}
        aria-label={'list_spans'}
        cells={cells}
        rows={this.rows(cells)}
        sortBy={{ index: this.state.sortIndex, direction: this.state.sortDirection }}
        onSort={(_event, index, sortDirection) => this.setState({ sortIndex: index, sortDirection: sortDirection })}
        // This style is declared on _overrides.scss
        className="table"
        rowWrapper={p => <RowWrapper {...p} className={(p.row as any).className} />}
      >
        <TableHeader />
        {this.props.items.length > 0 ? (
          <TableBody />
        ) : (
          <tbody>
            <tr>
              <td colSpan={cells.length}>
                <EmptyState variant={EmptyStateVariant.full}>
                  <Title headingLevel="h5" size="lg">
                    No spans found
                  </Title>
                  <EmptyStateBody>No spans match the current filters</EmptyStateBody>
                </EmptyState>
              </td>
            </tr>
          </tbody>
        )}
      </Table>
    );
  }
}

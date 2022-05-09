import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { EmptyState, EmptyStateBody, EmptyStateVariant, Title, TitleSizes } from '@patternfly/react-core';
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

import { buildRow } from './SpanTableItem';
import { compareNullable } from 'components/FilterList/FilterHelper';
import { MetricsStats } from 'types/Metrics';
import { KialiAppState } from 'store/Store';
import { KialiAppAction } from 'actions/KialiAppAction';
import { MetricsStatsQuery } from 'types/MetricsOptions';
import MetricsStatsThunkActions from 'actions/MetricsStatsThunkActions';
import { RichSpanData } from 'types/JaegerInfo';
import { sameSpans } from 'utils/tracing/TracingHelper';
import { buildQueriesFromSpans } from 'utils/tracing/TraceStats';
import { getSpanId } from '../../../utils/SearchParamUtils';

type SortableCell<T> = ICell & {
  compare?: (a: T, b: T) => number;
};

interface Props {
  items: RichSpanData[];
  namespace: string;
  externalURL?: string;
  loadMetricsStats: (queries: MetricsStatsQuery[]) => void;
  metricsStats: Map<string, MetricsStats>;
}

interface State {
  toggledLinks?: string;
  sortIndex: number;
  sortDirection: SortByDirection;
  expandedSpans: Map<string, boolean>;
}

class SpanTable extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const mapExpandedSpans = new Map();
    const isSpan = getSpanId();
    isSpan && mapExpandedSpans.set(isSpan, true);
    this.state = { sortIndex: 0, sortDirection: SortByDirection.asc, expandedSpans: mapExpandedSpans };
  }

  componentDidMount() {
    this.fetchComparisonMetrics(this.props.items);
  }

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>) {
    if (prevState.toggledLinks) {
      this.setState({ toggledLinks: undefined });
    }
    if (!sameSpans(prevProps.items, this.props.items)) {
      this.fetchComparisonMetrics(this.props.items);
    }
  }

  private fetchComparisonMetrics(items: RichSpanData[]) {
    const queries = buildQueriesFromSpans(items);
    this.props.loadMetricsStats(queries);
  }

  private cells = (): SortableCell<RichSpanData>[] => {
    return [
      {
        title: 'Timeline',
        transforms: [sortable, cellWidth(20)],
        compare: (a, b) => a.startTime - b.startTime
      },
      {
        title: 'App / Workload',
        transforms: [sortable, cellWidth(40)],
        compare: (a, b) => compareNullable(a.workload, b.workload, (a2, b2) => a2.localeCompare(b2))
      },
      {
        title: 'Summary',
        transforms: [cellWidth(100)]
      },
      {
        title: 'Statistics',
        transforms: [sortable, cellWidth(40)],
        compare: (a, b) => a.duration - b.duration
      },
      {
        title: '', // Links
        transforms: [cellWidth(10)]
      }
    ];
  };

  private rows = (cells: SortableCell<RichSpanData>[]) => {
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
        metricsStats: this.props.metricsStats,
        isExpanded: this.state.expandedSpans.get(item.spanID) || false,
        onExpand: isExpanded => {
          this.state.expandedSpans.set(item.spanID, isExpanded);
          this.setState({ expandedSpans: this.state.expandedSpans });
        },
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
                  <Title headingLevel="h5" size={TitleSizes.lg}>
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

const mapStateToProps = (state: KialiAppState) => ({
  metricsStats: state.metricsStats.data
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  loadMetricsStats: (queries: MetricsStatsQuery[]) => dispatch(MetricsStatsThunkActions.load(queries))
});

const Container = connect(mapStateToProps, mapDispatchToProps)(SpanTable);
export default Container;

import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import {
  Button,
  ButtonVariant,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Title,
  TitleSizes
} from '@patternfly/react-core';
import {
  Table,
  TableHeader,
  TableBody,
  TableVariant,
  RowWrapper,
  sortable,
  SortByDirection,
  ICell,
  IRow,
  IActionsResolver,
  IRowData,
  IExtraRowData,
  IAction,
  ISeparator
} from '@patternfly/react-table';
import { compareNullable } from 'components/FilterList/FilterHelper';
import { MetricsStats } from 'types/Metrics';
import { KialiAppState } from 'store/Store';
import { KialiAppAction } from 'actions/KialiAppAction';
import { MetricsStatsQuery } from 'types/MetricsOptions';
import MetricsStatsThunkActions from 'actions/MetricsStatsThunkActions';
import { EnvoySpanInfo, OpenTracingHTTPInfo, OpenTracingTCPInfo, RichSpanData } from 'types/JaegerInfo';
import { sameSpans } from 'utils/tracing/TracingHelper';
import { buildQueriesFromSpans } from 'utils/tracing/TraceStats';
import { getSpanId } from '../../../utils/SearchParamUtils';
import { style } from 'typestyle';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { formatDuration, isErrorTag } from 'utils/tracing/TracingHelper';
import { Link } from 'react-router-dom';
import { PFColors } from 'components/Pf/PfColors';
import responseFlags from 'utils/ResponseFlags';
import { renderMetricsComparison } from './StatsComparison';
import history from 'app/History';
import { AngleDownIcon, AngleRightIcon, ExternalLinkAltIcon } from '@patternfly/react-icons';

interface Props {
  externalURL?: string;
  items: RichSpanData[];
  namespace: string;
  loadMetricsStats: (queries: MetricsStatsQuery[]) => void;
  metricsStats: Map<string, MetricsStats>;
}

interface State {
  expandedSpans: Map<string, boolean>;
  openKebab?: string;
  sortDirection: SortByDirection;
  sortIndex: number;
}

type SortableCell<T> = ICell & {
  compare?: (a: T, b: T) => number;
};

const dangerErrorStyle = style({
  borderLeft: '3px solid var(--pf-global--danger-color--100)'
});

const selectedErrorStyle = style({
  borderRight: '3px solid var(--pf-global--info-color--100)',
  borderLeft: '3px solid var(--pf-global--danger-color--100)'
});

const selectedStyle = style({
  borderRight: '3px solid var(--pf-global--info-color--100)'
});

const rowKebabStyle = style({
  paddingLeft: 0,
  textAlign: 'left',
  whiteSpace: 'nowrap'
});

const linkStyle = style({
  fontSize: 14
});

const getClassName = (isError: boolean, isSpan: boolean): string | undefined => {
  return isSpan ? (isError ? selectedErrorStyle : selectedStyle) : isError ? dangerErrorStyle : undefined;
};

const cells: SortableCell<RichSpanData>[] = [
  {
    title: 'Timeline',
    transforms: [sortable],
    compare: (a, b) => a.startTime - b.startTime
  },
  {
    title: 'App / Workload',
    transforms: [sortable],
    compare: (a, b) => compareNullable(a.workload, b.workload, (a2, b2) => a2.localeCompare(b2))
  },
  {
    title: 'Summary',
    transforms: []
  },
  {
    title: 'Statistics',
    transforms: [sortable],
    compare: (a, b) => a.duration - b.duration
  }
];

class SpanTable extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const isSpan = getSpanId();
    const mapExpandedSpans = new Map();
    isSpan && mapExpandedSpans.set(isSpan, true);
    this.state = {
      expandedSpans: mapExpandedSpans,
      sortIndex: 0,
      sortDirection: SortByDirection.asc
    };
  }

  componentDidMount() {
    this.fetchComparisonMetrics(this.props.items);
  }

  componentDidUpdate(prevProps: Readonly<Props>) {
    if (!sameSpans(prevProps.items, this.props.items)) {
      this.fetchComparisonMetrics(this.props.items);
    }
  }

  render() {
    return (
      <Table
        variant={TableVariant.compact}
        aria-label={'list_spans'}
        cells={cells}
        rows={this.rows()}
        actionResolver={this.actionResolver}
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

  private fetchComparisonMetrics(items: RichSpanData[]) {
    const queries = buildQueriesFromSpans(items);
    this.props.loadMetricsStats(queries);
  }

  private rows = (): IRow[] => {
    const compare = cells[this.state.sortIndex].compare;
    const sorted = compare
      ? this.props.items.sort(this.state.sortDirection === SortByDirection.asc ? compare : (a, b) => compare(b, a))
      : this.props.items;

    return sorted.map(item => this.buildRow(item));
  };

  private buildRow = (item: RichSpanData): IRow => {
    const isExpanded = this.isExpanded(item.spanID);
    const isSpan = item.spanID === getSpanId();

    return {
      cells: [
        <div key={`${item.spanID}-duration`}>
          <Button
            style={{ padding: '6px 4px 6px 0' }}
            variant={ButtonVariant.link}
            onClick={() => this.toggleExpanded(item.spanID)}
          >
            {isExpanded ? <AngleDownIcon /> : <AngleRightIcon />}
          </Button>
          {formatDuration(item.relativeStartTime)}
        </div>,
        this.OriginCell(item),
        this.SummaryCell(item),
        this.StatsCell(item)
      ] as React.ReactNode[],
      className: getClassName(item.tags.some(isErrorTag), isSpan),
      item: item
    };
  };

  private actionResolver: IActionsResolver = (
    rowData: IRowData,
    _extraData: IExtraRowData
  ): (IAction | ISeparator)[] => {
    const item = rowData.item;

    const appActions: IAction[] = [
      {
        isDisabled: true,
        title: (
          <h1
            className={`pf-c-dropdown__group-title ${rowKebabStyle}`}
            aria-hidden="true"
          >{`Application (${item.app})`}</h1>
        )
      },
      {
        title: 'Inbound Metrics',
        onClick: (_event, _rowId, rowData, _extra) => history.push(rowData.item.linkToApp + '?tab=in_metrics')
      },
      {
        title: 'Outbound Metrics',
        onClick: (_event, _rowId, rowData, _extra) => history.push(rowData.item.linkToApp + '?tab=out_metrics')
      }
    ];

    let workloadActions: IAction[] = [];
    if (item.linkToWorkload) {
      workloadActions = [
        {
          isDisabled: true,
          title: (
            <h1
              className={`pf-c-dropdown__group-title ${rowKebabStyle}`}
              aria-hidden="true"
            >{`Workload (${item.workload})`}</h1>
          )
        },
        {
          title: 'Logs',
          onClick: (_event, _rowId, rowData, _extra) => history.push(rowData.item.linkToWorkload + '?tab=logs')
        },
        {
          title: 'Inbound Metrics',
          onClick: (_event, _rowId, rowData, _extra) => history.push(rowData.item.linkToWorkload + '?tab=in_metrics')
        },
        {
          title: 'Outbound Metrics',
          onClick: (_event, _rowId, rowData, _extra) => history.push(rowData.item.linkToWorkload + '?tab=out_metrics')
        }
      ];
    }

    let tracingActions: IAction[] = [];
    if (this.props.externalURL) {
      const spanLink = `${this.props.externalURL}/trace/${item.traceID}?uiFind=${item.spanID}`;
      tracingActions = [
        {
          isDisabled: true,
          title: <h1 className={`pf-c-dropdown__group-title ${rowKebabStyle}`} aria-hidden="true">{`Tracing`}</h1>
        },
        {
          title: (
            <span className={linkStyle}>
              More span details <ExternalLinkAltIcon />
            </span>
          ),
          onClick: (_event, _rowId, _rowData, _extra) => window.open(spanLink, '_blank')
        }
      ];
    }

    return [...appActions, ...workloadActions, ...tracingActions];
  };

  private isExpanded = (spanID: string): boolean => {
    return this.state.expandedSpans.get(spanID) || false;
  };

  private toggleExpanded = (spanID: string): void => {
    const isExpanded = this.isExpanded(spanID);
    this.state.expandedSpans.set(spanID, !isExpanded);
    this.setState({ expandedSpans: this.state.expandedSpans });
  };

  private OriginCell = (item: RichSpanData): React.ReactNode => {
    return (
      <div key={`${item.spanID}-origin`}>
        <strong>Application: </strong>
        {(item.linkToApp && <Link to={item.linkToApp}>{item.app}</Link>) || item.app}
        <br />
        <strong>Workload: </strong>
        {(item.linkToWorkload && <Link to={item.linkToWorkload}>{item.workload}</Link>) || 'unknown'}
        {this.isExpanded(item.spanID) && (
          <>
            <br />
            <strong>Pod: </strong>
            {item.pod || 'unknown'}
            <br />
          </>
        )}
      </div>
    );
  };

  private SummaryCell = (item: RichSpanData): React.ReactNode => {
    const flag = (item.info as EnvoySpanInfo).responseFlags;
    return (
      <div key={`${item.spanID}-summary`}>
        {item.info.hasError && (
          <div>
            <ExclamationCircleIcon color={PFColors.Danger} /> <strong>This span reported an error</strong>
          </div>
        )}
        <div>
          <strong>Operation: </strong>
          {flag ? (
            <>
              {item.operationName} ({flag} <ExclamationCircleIcon color={PFColors.Danger} />)
            </>
          ) : (
            <>{item.operationName}</>
          )}
        </div>
        <div>
          <strong>Component: </strong>
          {item.component}
        </div>
        {this.isExpanded(item.spanID) &&
          ((item.type === 'envoy' && this.renderEnvoySummary(item)) ||
            (item.type === 'http' && this.renderHTTPSummary(item)) ||
            (item.type === 'tcp' && this.renderTCPSummary(item)))}
      </div>
    );
  };

  private renderEnvoySummary = (item: RichSpanData) => {
    const info = item.info as EnvoySpanInfo;
    let rqLabel = 'Request';
    let peerLink: JSX.Element | undefined = undefined;
    if (info.direction === 'inbound') {
      rqLabel = 'Received request';
      if (info.peer) {
        peerLink = (
          <>
            {' from '}
            <Link to={'/namespaces/' + info.peer.namespace + '/workloads/' + info.peer.name}>{info.peer.name}</Link>
          </>
        );
      }
    } else if (info.direction === 'outbound') {
      rqLabel = 'Sent request';
      if (info.peer) {
        peerLink = (
          <>
            {' to '}
            <Link to={'/namespaces/' + info.peer.namespace + '/services/' + info.peer.name}>{info.peer.name}</Link>
          </>
        );
      }
    }
    const rsDetails: string[] = [];
    if (info.statusCode) {
      rsDetails.push(String(info.statusCode));
    }
    let flagInfo: string | undefined = undefined;
    if (info.responseFlags) {
      rsDetails.push(info.responseFlags);
      flagInfo = responseFlags[info.responseFlags]?.help || 'Unknown flag';
    }

    return (
      <>
        <div>
          <strong>
            {rqLabel}
            {peerLink}:{' '}
          </strong>
          {info.method} {info.url}
        </div>
        <div>
          <strong>Response status: </strong>
          {rsDetails.join(', ')}
        </div>
        {flagInfo}
      </>
    );
  };

  private renderHTTPSummary = (item: RichSpanData) => {
    const info = item.info as OpenTracingHTTPInfo;
    const rqLabel =
      info.direction === 'inbound' ? 'Received request' : info.direction === 'outbound' ? 'Sent request' : 'Request';
    return (
      <>
        <div>
          <strong>{rqLabel}: </strong>
          {info.method} {info.url}
        </div>
        {info.statusCode && (
          <div>
            <strong>Response status: </strong>
            {info.statusCode}
          </div>
        )}
      </>
    );
  };

  private renderTCPSummary = (item: RichSpanData) => {
    const info = item.info as OpenTracingTCPInfo;
    return (
      <>
        {info.topic && (
          <div>
            <strong>Topic: </strong>
            {info.topic}
          </div>
        )}
      </>
    );
  };

  private StatsCell = (item: RichSpanData): React.ReactNode => {
    return (
      <div key={`${item.spanID}-stats`}>
        <div>
          <strong>Duration: </strong>
          {formatDuration(item.duration)}
        </div>
        {item.type === 'envoy' &&
          renderMetricsComparison(item, !this.isExpanded(item.spanID), this.props.metricsStats, () =>
            this.fetchComparisonMetrics([item])
          )}
      </div>
    );
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  metricsStats: state.metricsStats.data
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  loadMetricsStats: (queries: MetricsStatsQuery[]) => dispatch(MetricsStatsThunkActions.load(queries))
});

const Container = connect(mapStateToProps, mapDispatchToProps)(SpanTable);
export default Container;

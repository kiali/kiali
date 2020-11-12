import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Dropdown,
  DropdownGroup,
  DropdownItem,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  KebabToggle,
  Title
} from '@patternfly/react-core';
import {
  Table,
  TableHeader,
  TableBody,
  TableVariant,
  RowWrapper,
  sortable,
  SortByDirection,
  ICell
} from '@patternfly/react-table';
import { ExternalLinkAltIcon, ExclamationCircleIcon } from '@patternfly/react-icons';

import { addError, addInfo } from 'utils/AlertUtils';
import history from 'app/History';
import { formatDuration } from './transform';
import { EnvoySpanInfo, isErrorTag, OpenTracingHTTPInfo, OpenTracingTCPInfo } from '../JaegerHelper';
import { style } from 'typestyle';
import { PFAlertColor } from 'components/Pf/PfColors';
import { SpanTableItem } from './SpanTableItem';
import { compareNullable } from 'components/FilterList/FilterHelper';
import { MetricsStats } from 'types/Metrics';
import { fetchStats, renderMetricsComparison } from './StatsComparison';

type SortableCell<T> = ICell & {
  compare?: (a: T, b: T) => number;
};

const dangerErrorStyle = style({
  borderLeft: '3px solid var(--pf-global--danger-color--100)'
});

interface Props {
  spans: SpanTableItem[];
  namespace: string;
  externalURL?: string;
}

interface State {
  toggled?: string;
  sortIndex: number;
  sortDirection: SortByDirection;
  metricsStats: { [key: string]: MetricsStats };
}

const kebabDropwdownStyle = style({
  whiteSpace: 'nowrap'
});

const linkStyle = style({
  fontSize: 14
});

export class SpanTable extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { sortIndex: 0, sortDirection: SortByDirection.asc, metricsStats: {} };
  }

  componentDidMount() {
    // Load stats for first 10 spans, to avoid heavy loading. More stats can be loaded individually.
    this.fetchComparisonMetrics(this.props.spans.filter(s => s.type === 'envoy').slice(0, 10));
  }

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>) {
    if (prevState.toggled) {
      this.setState({ toggled: undefined });
    }
    if (this.props.spans !== prevProps.spans) {
      this.setState({ metricsStats: {} });
      // Load stats for first 10 spans, to avoid heavy loading. More stats can be loaded individually.
      this.fetchComparisonMetrics(this.props.spans.filter(s => s.type === 'envoy').slice(0, 10));
    }
  }

  private fetchComparisonMetrics(spans: SpanTableItem[]) {
    fetchStats(spans)
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

  private renderLinks = (key: string, item: SpanTableItem) => {
    const links = [
      <DropdownGroup label={`Application (${item.app})`} className={kebabDropwdownStyle}>
        <DropdownItem className={linkStyle} onClick={() => history.push(item.linkToApp + '?tab=in_metrics')}>
          Inbound metrics
        </DropdownItem>
        <DropdownItem className={linkStyle} onClick={() => history.push(item.linkToApp + '?tab=out_metrics')}>
          Outbound metrics
        </DropdownItem>
      </DropdownGroup>
    ];
    if (item.linkToWorkload) {
      links.push(
        <DropdownGroup label={`Workload (${item.workload})`} className={kebabDropwdownStyle}>
          <DropdownItem className={linkStyle} onClick={() => history.push(item.linkToWorkload + '?tab=logs')}>
            Logs
          </DropdownItem>
          <DropdownItem className={linkStyle} onClick={() => history.push(item.linkToWorkload + '?tab=in_metrics')}>
            Inbound metrics
          </DropdownItem>
          <DropdownItem className={linkStyle} onClick={() => history.push(item.linkToWorkload + '?tab=out_metrics')}>
            Outbound metrics
          </DropdownItem>
        </DropdownGroup>
      );
    }
    if (this.props.externalURL) {
      const spanLink = `${this.props.externalURL}/trace/${item.traceID}?uiFind=${item.spanID}`;
      links.push(
        <DropdownGroup label="Tracing" className={kebabDropwdownStyle}>
          <DropdownItem className={linkStyle} onClick={() => window.open(spanLink, '_blank')}>
            More span details <ExternalLinkAltIcon />
          </DropdownItem>
        </DropdownGroup>
      );
    }
    return (
      <Dropdown
        toggle={
          <KebabToggle
            onToggle={() => {
              this.setState({ toggled: key });
            }}
          />
        }
        dropdownItems={links}
        isPlain={true}
        isOpen={this.state.toggled === key}
        position={'right'}
      />
    );
  };

  private renderSummary = (item: SpanTableItem) => {
    switch (item.type) {
      case 'envoy':
        return this.renderEnvoySummary(item);
      case 'http':
        return this.renderHTTPSummary(item);
      case 'tcp':
        return this.renderTCPSummary(item);
    }
    // Unknown
    return this.renderCommonSummary(item);
  };

  private renderCommonSummary(item: SpanTableItem) {
    return (
      <>
        {item.hasError && (
          <div>
            <ExclamationCircleIcon color={PFAlertColor.Danger} /> <strong>This span reported an error</strong>
          </div>
        )}
        <div>
          <strong>Operation: </strong>
          {item.operationName}
        </div>
        <div>
          <strong>Component: </strong>
          {item.component}
        </div>
      </>
    );
  }

  private renderEnvoySummary(item: SpanTableItem) {
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
    if (info.responseFlags) {
      rsDetails.push(info.responseFlags);
    }

    return (
      <>
        {this.renderCommonSummary(item)}
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
      </>
    );
  }

  private renderHTTPSummary(item: SpanTableItem) {
    const info = item.info as OpenTracingHTTPInfo;
    const rqLabel =
      info.direction === 'inbound' ? 'Received request' : info.direction === 'outbound' ? 'Sent request' : 'Request';
    return (
      <>
        {this.renderCommonSummary(item)}
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
  }

  private renderTCPSummary(item: SpanTableItem) {
    const info = item.info as OpenTracingTCPInfo;
    return (
      <>
        {this.renderCommonSummary(item)}
        {info.topic && (
          <div>
            <strong>Topic: </strong>
            {info.topic}
          </div>
        )}
      </>
    );
  }

  private renderStats(item: SpanTableItem) {
    return (
      <>
        <div>
          <strong>Duration: </strong>
          {formatDuration(item.duration)}
        </div>
        {item.type === 'envoy' &&
          renderMetricsComparison(item, this.state.metricsStats, () => this.fetchComparisonMetrics([item]))}
      </>
    );
  }

  private cells = (): SortableCell<SpanTableItem>[] => {
    return [
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
      { title: 'Summary' },
      {
        title: 'Statistics',
        transforms: [sortable],
        compare: (a, b) => a.duration - b.duration
      },
      { title: '' } // Links
    ];
  };

  private rows = (cells: SortableCell<SpanTableItem>[]) => {
    const compare = cells[this.state.sortIndex].compare;
    const sorted = compare
      ? this.props.spans.sort(this.state.sortDirection === SortByDirection.asc ? compare : (a, b) => compare(b, a))
      : this.props.spans;
    return sorted.map((item, idx) => {
      return {
        className: item.tags.some(isErrorTag) ? dangerErrorStyle : undefined,
        isOpen: false,
        cells: [
          { title: <>{formatDuration(item.relativeStartTime)}</> },
          {
            title: (
              <>
                <strong>Application: </strong>
                <Link to={item.linkToApp}>{item.app}</Link>
                <br />
                <strong>Workload: </strong>
                {(item.linkToWorkload && <Link to={item.linkToWorkload}>{item.workload}</Link>) || 'unknown'}
                <br />
                <strong>Pod: </strong>
                {item.pod || 'unknown'}
                <br />
              </>
            )
          },
          { title: this.renderSummary(item) },
          { title: this.renderStats(item) },
          { title: this.renderLinks(String(idx), item) }
        ]
      };
    });
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
        {this.props.spans.length > 0 ? (
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

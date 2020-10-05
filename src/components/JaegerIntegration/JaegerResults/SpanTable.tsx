import * as React from 'react';
import { Link } from 'react-router-dom';
import { Dropdown, DropdownGroup, DropdownItem, KebabToggle } from '@patternfly/react-core';
import { Table, TableHeader, TableBody, TableVariant, RowWrapper } from '@patternfly/react-table';
import { ExternalLinkAltIcon, ExclamationCircleIcon } from '@patternfly/react-icons';

import history from 'app/History';
import { Span } from 'types/JaegerInfo';
import { formatDuration } from './transform';
import {
  extractEnvoySpanInfo,
  extractOpenTracingBaseInfo,
  extractOpenTracingHTTPInfo,
  extractOpenTracingTCPInfo,
  getSpanType,
  getWorkloadFromSpan,
  isErrorTag
} from '../JaegerHelper';
import { style } from 'typestyle';
import { PFAlertColor } from 'components/Pf/PfColors';

const dangerErrorStyle = style({
  borderLeft: '3px solid var(--pf-global--danger-color--100)'
});

interface Props {
  spans: Span[];
  namespace: string;
  externalURL?: string;
}

interface State {
  toggled?: string;
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
    this.state = {};
  }

  componentDidUpdate(_: Readonly<Props>, prevState: Readonly<State>) {
    if (prevState.toggled) {
      this.setState({ toggled: undefined });
    }
  }

  private renderLinks = (
    key: string,
    span: Span,
    linkToApp: string,
    linkToWorkload: string | undefined,
    app: string,
    workload: string | undefined
  ) => {
    const links = [
      <DropdownGroup label={`Application (${app})`} className={kebabDropwdownStyle}>
        <DropdownItem className={linkStyle} onClick={() => history.push(linkToApp + '?tab=in_metrics')}>
          Inbound metrics
        </DropdownItem>
        <DropdownItem className={linkStyle} onClick={() => history.push(linkToApp + '?tab=out_metrics')}>
          Outbound metrics
        </DropdownItem>
      </DropdownGroup>
    ];
    if (linkToWorkload) {
      links.push(
        <DropdownGroup label={`Workload (${workload})`} className={kebabDropwdownStyle}>
          <DropdownItem className={linkStyle} onClick={() => history.push(linkToWorkload + '?tab=logs')}>
            Logs
          </DropdownItem>
          <DropdownItem className={linkStyle} onClick={() => history.push(linkToWorkload + '?tab=in_metrics')}>
            Inbound metrics
          </DropdownItem>
          <DropdownItem className={linkStyle} onClick={() => history.push(linkToWorkload + '?tab=out_metrics')}>
            Outbound metrics
          </DropdownItem>
        </DropdownGroup>
      );
    }
    if (this.props.externalURL) {
      const spanLink = `${this.props.externalURL}/trace/${span.traceID}?uiFind=${span.spanID}`;
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

  private renderSummary = (span: Span) => {
    switch (getSpanType(span)) {
      case 'envoy':
        return this.renderEnvoySummary(span);
      case 'http':
        return this.renderHTTPSummary(span);
      case 'tcp':
        return this.renderTCPSummary(span);
    }
    // Unknown
    return this.renderCommonSummary(span);
  };

  private renderCommonSummary(span: Span) {
    const info = extractOpenTracingBaseInfo(span);
    return (
      <>
        {info.hasError && (
          <div>
            <ExclamationCircleIcon color={PFAlertColor.Danger} /> <strong>This span reported an error</strong>
          </div>
        )}
        <div>
          <strong>Operation: </strong>
          {span.operationName}
        </div>
        <div>
          <strong>Component: </strong>
          {info.component || 'unknown'}
        </div>
      </>
    );
  }

  private renderEnvoySummary(span: Span) {
    const info = extractEnvoySpanInfo(span);
    let rqLabel = 'Request';
    let peerLink: JSX.Element | undefined = undefined;
    if (info.direction === 'inbound') {
      rqLabel = 'Received request';
      if (info.peer && info.peerNamespace) {
        peerLink = (
          <>
            {' from '}
            <Link to={'/namespaces/' + info.peerNamespace + '/workloads/' + info.peer}>{info.peer}</Link>
          </>
        );
      }
    } else if (info.direction === 'outbound') {
      rqLabel = 'Sent request';
      if (info.peer && info.peerNamespace) {
        peerLink = (
          <>
            {' to '}
            <Link to={'/namespaces/' + info.peerNamespace + '/services/' + info.peer}>{info.peer}</Link>
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
        {this.renderCommonSummary(span)}
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

  private renderHTTPSummary(span: Span) {
    const info = extractOpenTracingHTTPInfo(span);
    const rqLabel =
      info.direction === 'inbound' ? 'Received request' : info.direction === 'outbound' ? 'Sent request' : 'Request';
    return (
      <>
        {this.renderCommonSummary(span)}
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

  private renderTCPSummary(span: Span) {
    const info = extractOpenTracingTCPInfo(span);
    return (
      <>
        {this.renderCommonSummary(span)}
        {info.topic && (
          <div>
            <strong>Topic: </strong>
            {info.topic}
          </div>
        )}
      </>
    );
  }

  private rows = () => {
    return this.props.spans.map((span, idx) => {
      const split = span.process.serviceName.split('.');
      const app = split[0];
      const ns = split.length > 1 ? split[1] : this.props.namespace;
      const linkToApp = '/namespaces/' + ns + '/applications/' + app;
      const workloadNs = getWorkloadFromSpan(span);
      const linkToWorkload = workloadNs
        ? '/namespaces/' + workloadNs.namespace + '/workloads/' + workloadNs.workload
        : undefined;
      return {
        className: span.tags.some(isErrorTag) ? dangerErrorStyle : undefined,
        isOpen: false,
        cells: [
          { title: <>{formatDuration(span.relativeStartTime)}</> },
          {
            title: (
              <>
                <strong>Application: </strong>
                <Link to={linkToApp}>{app}</Link>
                <br />
                <strong>Workload: </strong>
                {(linkToWorkload && <Link to={linkToWorkload}>{workloadNs!.workload}</Link>) || 'unknown'}
                <br />
                <strong>Pod: </strong>
                {workloadNs ? workloadNs.pod : 'unknown'}
                <br />
              </>
            )
          },
          { title: this.renderSummary(span) },
          {
            title: <>{formatDuration(span.duration)}</>
          },
          { title: this.renderLinks(String(idx), span, linkToApp, linkToWorkload, app, workloadNs?.workload) }
        ]
      };
    });
  };

  render() {
    return (
      <Table
        variant={TableVariant.compact}
        aria-label={'list_spans'}
        cells={[
          { title: 'Timeline' },
          { title: 'App / Workload' },
          { title: 'Summary' },
          { title: 'Duration' },
          { title: '' } // Links
        ]}
        rows={this.rows()}
        // This style is declared on _overrides.scss
        className="table"
        rowWrapper={p => <RowWrapper {...p} className={(p.row as any).className} />}
      >
        <TableHeader />
        <TableBody />
      </Table>
    );
  }
}

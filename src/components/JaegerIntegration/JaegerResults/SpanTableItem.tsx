import * as React from 'react';
import { Link } from 'react-router-dom';
import { style } from 'typestyle';
import { Dropdown, DropdownGroup, DropdownItem, KebabToggle } from '@patternfly/react-core';
import { ExternalLinkAltIcon, ExclamationCircleIcon } from '@patternfly/react-icons';

import history from 'app/History';
import { PFAlertColor } from 'components/Pf/PfColors';
import { EnvoySpanInfo, OpenTracingHTTPInfo, OpenTracingTCPInfo, RichSpanData } from 'types/JaegerInfo';
import { isErrorTag } from '../JaegerHelper';
import { formatDuration } from './transform';
import { renderMetricsComparison } from './StatsComparison';
import { MetricsStats } from 'types/Metrics';
import { CellProps, createListeners, Expandable, renderExpandArrow } from 'components/Expandable';

const dangerErrorStyle = style({
  borderLeft: '3px solid var(--pf-global--danger-color--100)'
});

const kebabDropwdownStyle = style({
  whiteSpace: 'nowrap'
});

const linkStyle = style({
  fontSize: 14
});

type RowProps = RichSpanData & {
  toggledLinks?: string;
  setToggledLinks: (key: string) => void;
  externalURL?: string;
  onClickFetchStats: () => void;
  metricsStats: Map<string, MetricsStats>;
  // onExpand and isExpandable are used to keep the extend state at an upper level
  onExpand: (isExpanded: boolean) => void;
  isExpanded: boolean;
};

export const buildRow = (props: RowProps) => {
  const expandListeners = createListeners();
  expandListeners.push(props.onExpand);
  return {
    className: props.tags.some(isErrorTag) ? dangerErrorStyle : undefined,
    isOpen: false,
    cells: [
      {
        title: (
          <>
            {renderExpandArrow(expandListeners, props.isExpanded)} {formatDuration(props.relativeStartTime)}
          </>
        )
      },
      {
        title: <Expandable {...props} clickToExpand={false} listeners={expandListeners} innerComponent={OriginCell} />
      },
      {
        title: <Expandable {...props} clickToExpand={false} listeners={expandListeners} innerComponent={SummaryCell} />
      },
      { title: <Expandable {...props} clickToExpand={true} listeners={expandListeners} innerComponent={StatsCell} /> },
      { title: <Expandable {...props} clickToExpand={false} listeners={expandListeners} innerComponent={LinksCell} /> }
    ],
    spanID: props.spanID
  };
};

const OriginCell = (props: CellProps<RowProps>) => {
  return (
    <>
      <strong>Application: </strong>
      {(props.linkToApp && <Link to={props.linkToApp}>{props.app}</Link>) || props.app}
      <br />
      <strong>Workload: </strong>
      {(props.linkToWorkload && <Link to={props.linkToWorkload}>{props.workload}</Link>) || 'unknown'}
      {props.isExpanded && (
        <>
          <br />
          <strong>Pod: </strong>
          {props.pod || 'unknown'}
          <br />
        </>
      )}
    </>
  );
};

const SummaryCell = (props: CellProps<RowProps>) => {
  return (
    <>
      {props.info.hasError && (
        <div>
          <ExclamationCircleIcon color={PFAlertColor.Danger} /> <strong>This span reported an error</strong>
        </div>
      )}
      <div>
        <strong>Operation: </strong>
        {props.operationName}
      </div>
      <div>
        <strong>Component: </strong>
        {props.component}
      </div>
      {props.isExpanded &&
        ((props.type === 'envoy' && renderEnvoySummary(props)) ||
          (props.type === 'http' && renderHTTPSummary(props)) ||
          (props.type === 'tcp' && renderTCPSummary(props)))}
    </>
  );
};

const renderEnvoySummary = (props: CellProps<RowProps>) => {
  const info = props.info as EnvoySpanInfo;
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
};

const renderHTTPSummary = (props: CellProps<RowProps>) => {
  const info = props.info as OpenTracingHTTPInfo;
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

const renderTCPSummary = (props: CellProps<RowProps>) => {
  const info = props.info as OpenTracingTCPInfo;
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

const StatsCell = (props: CellProps<RowProps>) => {
  return (
    <>
      <div>
        <strong>Duration: </strong>
        {formatDuration(props.duration)}
      </div>
      {props.type === 'envoy' &&
        renderMetricsComparison(props, !props.isExpanded, props.metricsStats, props.onClickFetchStats)}
    </>
  );
};

const LinksCell = (props: CellProps<RowProps>) => {
  const links = [
    <DropdownGroup label={`Application (${props.app})`} className={kebabDropwdownStyle}>
      <DropdownItem className={linkStyle} onClick={() => history.push(props.linkToApp + '?tab=in_metrics')}>
        Inbound metrics
      </DropdownItem>
      <DropdownItem className={linkStyle} onClick={() => history.push(props.linkToApp + '?tab=out_metrics')}>
        Outbound metrics
      </DropdownItem>
    </DropdownGroup>
  ];
  if (props.linkToWorkload) {
    links.push(
      <DropdownGroup label={`Workload (${props.workload})`} className={kebabDropwdownStyle}>
        <DropdownItem className={linkStyle} onClick={() => history.push(props.linkToWorkload + '?tab=logs')}>
          Logs
        </DropdownItem>
        <DropdownItem className={linkStyle} onClick={() => history.push(props.linkToWorkload + '?tab=in_metrics')}>
          Inbound metrics
        </DropdownItem>
        <DropdownItem className={linkStyle} onClick={() => history.push(props.linkToWorkload + '?tab=out_metrics')}>
          Outbound metrics
        </DropdownItem>
      </DropdownGroup>
    );
  }
  if (props.externalURL) {
    const spanLink = `${props.externalURL}/trace/${props.traceID}?uiFind=${props.spanID}`;
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
      toggle={<KebabToggle onToggle={() => props.setToggledLinks(props.spanID)} />}
      dropdownItems={links}
      isPlain={true}
      isOpen={props.toggledLinks === props.spanID}
      position={'right'}
    />
  );
};

import * as React from 'react';
import { Link } from 'react-router-dom';
import { style } from 'typestyle';
import { Dropdown, DropdownGroup, DropdownItem, KebabToggle } from '@patternfly/react-core';
import { ExternalLinkAltIcon, ExclamationCircleIcon } from '@patternfly/react-icons';

import history from 'app/History';
import { PFAlertColor } from 'components/Pf/PfColors';
import { EnvoySpanInfo, OpenTracingHTTPInfo, OpenTracingTCPInfo, RichSpanData } from 'types/JaegerInfo';
import { renderMetricsComparison } from './StatsComparison';
import { MetricsStats } from 'types/Metrics';
import { CellProps, createListeners, Expandable, renderExpandArrow } from 'components/Expandable';
import { formatDuration, isErrorTag } from 'utils/tracing/TracingHelper';
import responseFlags from 'utils/ResponseFlags';
import { getSpanId } from '../../../utils/SearchParamUtils';

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

const getClassName = (isError: boolean, isSpan: boolean): string | undefined => {
  return isSpan ? (isError ? selectedErrorStyle : selectedStyle) : isError ? dangerErrorStyle : undefined;
};

export const buildRow = (props: RowProps) => {
  const expandListeners = createListeners();
  const isSpan = props.spanID === getSpanId();
  expandListeners.push(props.onExpand);
  return {
    className: getClassName(props.tags.some(isErrorTag), isSpan),
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
        title: <Expandable {...props} clickToExpand={true} listeners={expandListeners} innerComponent={SummaryCell} />
      },
      {
        title: <Expandable {...props} clickToExpand={true} listeners={expandListeners} innerComponent={StatsCell} />
      },
      {
        title: <Expandable {...props} clickToExpand={false} listeners={expandListeners} innerComponent={LinksCell} />
      }
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
  const flag = (props.info as EnvoySpanInfo).responseFlags;
  return (
    <>
      {props.info.hasError && (
        <div>
          <ExclamationCircleIcon color={PFAlertColor.Danger} /> <strong>This span reported an error</strong>
        </div>
      )}
      <div>
        <strong>Operation: </strong>
        {flag ? (
          <>
            {props.operationName} ({flag} <ExclamationCircleIcon color={PFAlertColor.Danger} />)
          </>
        ) : (
          <>{props.operationName}</>
        )}
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

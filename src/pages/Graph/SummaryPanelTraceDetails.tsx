import * as React from 'react';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { style } from 'typestyle';
import { Tooltip, Button, ButtonVariant, pluralize } from '@patternfly/react-core';
import {
  CloseIcon,
  AngleLeftIcon,
  AngleRightIcon,
  ExternalLinkAltIcon,
  ExclamationCircleIcon
} from '@patternfly/react-icons';

import { URLParam } from '../../app/History';
import { JaegerTrace, Span } from 'types/JaegerInfo';
import { KialiAppState } from 'store/Store';
import { KialiAppAction } from 'actions/KialiAppAction';
import { JaegerThunkActions } from 'actions/JaegerThunkActions';
import { PFAlertColor } from 'components/Pf/PfColors';
import {
  extractEnvoySpanInfo,
  extractOpenTracingHTTPInfo,
  extractOpenTracingTCPInfo,
  getSpanType
} from 'components/JaegerIntegration/JaegerHelper';
import { formatDuration } from 'components/JaegerIntegration/JaegerResults/transform';
import { CytoscapeGraphSelectorBuilder } from 'components/CytoscapeGraph/CytoscapeGraphSelector';
import { decoratedNodeData } from 'components/CytoscapeGraph/CytoscapeGraphUtils';
import FocusAnimation from 'components/CytoscapeGraph/FocusAnimation';
import { FormattedTraceInfo, shortIDStyle } from 'components/JaegerIntegration/JaegerResults/FormattedTraceInfo';

type Props = {
  trace: JaegerTrace;
  node: any;
  jaegerURL?: string;
  close: () => void;
};

type State = {
  selectedSpan: number;
};

const textHeaderStyle = style({
  fontWeight: 'bold',
  fontSize: '16px'
});

const closeBoxStyle = style({
  float: 'right',
  marginTop: '-7px'
});

const nameStyle = style({
  display: 'inline-block',
  maxWidth: '95%',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  whiteSpace: 'nowrap'
});

const pStyle = style({
  paddingTop: 9
});

const navButtonStyle = style({
  paddingTop: 5,
  paddingLeft: 0
});

const navSpanStyle = style({
  position: 'relative',
  top: -1
});

class SummaryPanelTraceDetails extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { selectedSpan: 0 };
  }

  componentDidUpdate(props: Props) {
    if (props.trace.traceID !== this.props.trace.traceID) {
      this.setState({ selectedSpan: 0 });
    } else {
      // Current active span changed?
      const oldSpans: Span[] | undefined = props.node.data('spans');
      const newSpans: Span[] | undefined = this.props.node.data('spans');
      const oldSpan =
        oldSpans && this.state.selectedSpan < oldSpans.length ? oldSpans[this.state.selectedSpan] : undefined;
      const newSpan =
        newSpans && this.state.selectedSpan < newSpans.length ? newSpans[this.state.selectedSpan] : undefined;
      if (oldSpan?.spanID !== newSpan?.spanID) {
        this.setState({ selectedSpan: 0 });
      }
    }
  }

  render() {
    const node = decoratedNodeData(this.props.node);
    const tracesDetailsURL = node.namespace
      ? `/namespaces/${node.namespace}` +
        (node.workload
          ? `/workloads/${node.workload}`
          : node.service
          ? `/services/${node.service}`
          : `/applications/${node.app!}`) +
        `?tab=traces&${URLParam.JAEGER_TRACE_ID}=${this.props.trace.traceID}`
      : undefined;
    const jaegerTraceURL = this.props.jaegerURL
      ? `${this.props.jaegerURL}/trace/${this.props.trace.traceID}`
      : undefined;
    const info = new FormattedTraceInfo(this.props.trace);
    const title = (
      <span className={nameStyle}>
        {info.name()}
        <span className={shortIDStyle}>{info.shortID()}</span>
      </span>
    );
    const nodeName = node.workload || node.service || node.app!;
    const spans: Span[] | undefined = this.props.node.data('spans');
    return (
      <>
        <span className={textHeaderStyle}>Trace</span>
        <span className={closeBoxStyle}>
          <Tooltip content="Close and clear trace selection">
            <Button id="close-trace" variant="plain" onClick={this.props.close}>
              <CloseIcon />
            </Button>
          </Tooltip>
        </span>
        <div>
          {tracesDetailsURL ? (
            <Tooltip content={'View trace details'}>
              <Link to={tracesDetailsURL}>{title}</Link>
            </Tooltip>
          ) : (
            title
          )}
          <div>
            {info.numErrors !== 0 && (
              <>
                <ExclamationCircleIcon color={PFAlertColor.Danger} />{' '}
                <strong>This trace has {pluralize(info.numErrors, 'error')}.</strong>
              </>
            )}
            <div>
              <strong>Started: </strong>
              {info.fromNow()}
            </div>
            {info.duration() && (
              <div>
                <strong>Full duration: </strong>
                {info.duration()}
              </div>
            )}
          </div>
          {spans && (
            <div className={pStyle}>
              <div>
                <strong>Spans for node: </strong>
                {nodeName}
              </div>
              <div>
                <Button
                  className={navButtonStyle}
                  variant={ButtonVariant.plain}
                  isDisabled={this.state.selectedSpan === 0}
                  onClick={_ => {
                    if (this.state.selectedSpan > 0) {
                      this.setState({ selectedSpan: this.state.selectedSpan - 1 });
                    }
                  }}
                >
                  <AngleLeftIcon />
                </Button>
                <span className={navSpanStyle}>{this.state.selectedSpan + 1 + ' of ' + spans.length}</span>
                <Button
                  variant={ButtonVariant.plain}
                  isDisabled={this.state.selectedSpan >= spans.length - 1}
                  onClick={_ => {
                    if (this.state.selectedSpan < spans.length) {
                      this.setState({ selectedSpan: this.state.selectedSpan + 1 });
                    }
                  }}
                >
                  <AngleRightIcon />
                </Button>
              </div>
              {this.state.selectedSpan < spans.length &&
                this.renderSpan(nodeName + '.' + node.namespace, spans[this.state.selectedSpan])}
            </div>
          )}
          {jaegerTraceURL && (
            <>
              <br />
              <a href={jaegerTraceURL} target="_blank" rel="noopener noreferrer">
                Show in Tracing <ExternalLinkAltIcon size="sm" />
              </a>
            </>
          )}
        </div>
      </>
    );
  }

  private renderSpan(nodeFullName: string, span: Span) {
    switch (getSpanType(span)) {
      case 'envoy':
        return this.renderEnvoySpan(nodeFullName, span);
      case 'http':
        return this.renderHTTPSpan(span);
      case 'tcp':
        return this.renderTCPSpan(span);
    }
    // Unknown
    return this.renderCommonSpan(span);
  }

  private renderCommonSpan(span: Span) {
    return (
      <>
        <div>
          <strong>Operation: </strong>
          {span.operationName}
        </div>
        <div>
          <strong>Started after: </strong>
          {formatDuration(span.relativeStartTime)}
        </div>
        <div>
          <strong>Duration: </strong>
          {formatDuration(span.duration)}
        </div>
      </>
    );
  }

  private renderEnvoySpan(nodeFullName: string, span: Span) {
    const info = extractEnvoySpanInfo(span);
    const rsDetails: string[] = [];
    if (
      nodeFullName !== span.process.serviceName &&
      info.direction === 'inbound' &&
      nodeFullName === info.peer + '.' + info.peerNamespace
    ) {
      // Special case: this span was added to the inbound workload (this node) while originating from the outbound node.
      // So we need to reverse the logic: it's not an inbound request that we show here, but an outbound request, switching point of view.
      info.direction = 'outbound';
      const split = span.process.serviceName.split('.');
      info.peer = split[0];
      if (split.length > 1) {
        info.peerNamespace = split[1];
      }
    }
    if (info.statusCode) {
      rsDetails.push('code ' + info.statusCode);
    }
    if (info.responseFlags) {
      rsDetails.push('flags ' + info.responseFlags);
    }
    if (span.duration) {
      rsDetails.push(formatDuration(span.duration));
    }

    return (
      <>
        {info.direction && info.peer && info.peerNamespace && (
          <>
            <span>
              <strong>{info.direction === 'inbound' ? 'From: ' : 'To: '}</strong>
            </span>
            <Button
              variant={ButtonVariant.link}
              onClick={
                info.direction === 'inbound'
                  ? () => this.focusOnWorkload(info.peerNamespace!, info.peer!)
                  : () => this.focusOnService(info.peerNamespace!, info.peer!)
              }
              isInline
            >
              <span style={{ fontSize: 'var(--graph-side-panel--font-size)' }}>{info.peer}</span>
            </Button>
          </>
        )}
        <div>
          <strong>Operation: </strong>
          {span.operationName}
        </div>
        <div>
          <strong>Started after: </strong>
          {formatDuration(span.relativeStartTime)}
        </div>
        <div>
          <strong>Request: </strong>
          {info.method} {info.url}
        </div>
        <div>
          <strong>Response: </strong>
          {rsDetails.join(', ')}
        </div>
      </>
    );
  }

  private renderHTTPSpan(span: Span) {
    const info = extractOpenTracingHTTPInfo(span);
    const rsDetails: string[] = [];
    if (info.statusCode) {
      rsDetails.push('code ' + info.statusCode);
    }
    if (span.duration) {
      rsDetails.push(formatDuration(span.duration));
    }
    const rqLabel =
      info.direction === 'inbound' ? 'Inbound request' : info.direction === 'outbound' ? 'Outbound request' : 'Request';
    return (
      <>
        <div>
          <strong>Operation: </strong>
          {span.operationName}
        </div>
        <div>
          <strong>Started after: </strong>
          {formatDuration(span.relativeStartTime)}
        </div>
        <div>
          <strong>{rqLabel}: </strong>
          {info.method} {info.url}
        </div>
        <div>
          <strong>Response: </strong>
          {rsDetails.join(', ')}
        </div>
      </>
    );
  }

  private renderTCPSpan(span: Span) {
    const info = extractOpenTracingTCPInfo(span);
    return (
      <>
        <div>
          <strong>Operation: </strong>
          {span.operationName}
        </div>
        <div>
          <strong>Started after: </strong>
          {formatDuration(span.relativeStartTime)}
        </div>
        {info.topic && (
          <div>
            <strong>Topic: </strong>
            {info.topic}
          </div>
        )}
        <div>
          <strong>Duration: </strong>
          {formatDuration(span.duration)}
        </div>
      </>
    );
  }

  private focusOnWorkload = (namespace: string, workload: string) => {
    this.focusOn(new CytoscapeGraphSelectorBuilder().namespace(namespace).workload(workload).class('span').build());
  };

  private focusOnService = (namespace: string, service: string) => {
    this.focusOn(new CytoscapeGraphSelectorBuilder().namespace(namespace).service(service).class('span').build());
  };

  private focusOn = (selector: string) => {
    const cy = this.props.node.cy();
    new FocusAnimation(cy).start(cy.elements(selector));
  };
}

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  close: () => dispatch(JaegerThunkActions.setTraceId(undefined))
});

const SummaryPanelTraceDetailsContainer = connect(() => ({}), mapDispatchToProps)(SummaryPanelTraceDetails);
export default SummaryPanelTraceDetailsContainer;

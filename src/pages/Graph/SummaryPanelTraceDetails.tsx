import * as React from 'react';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { style } from 'typestyle';
import { Tooltip, Button, ButtonVariant } from '@patternfly/react-core';
import { CloseIcon, AngleLeftIcon, AngleRightIcon, ExternalLinkAltIcon } from '@patternfly/react-icons';

import { URLParam } from '../../app/History';
import { JaegerTrace, Span } from 'types/JaegerInfo';
import { KialiAppState } from 'store/Store';
import { KialiAppAction } from 'actions/KialiAppAction';
import { JaegerThunkActions } from 'actions/JaegerThunkActions';
import { getFormattedTraceInfo } from 'components/JaegerIntegration/JaegerResults/FormattedTraceInfo';
import { PFAlertColor, PfColors } from 'components/Pf/PfColors';
import { extractEnvoySpanInfo } from 'components/JaegerIntegration/JaegerHelper';
import { formatDuration } from 'components/JaegerIntegration/JaegerResults/transform';
import { CytoscapeGraphSelectorBuilder } from 'components/CytoscapeGraph/CytoscapeGraphSelector';
import { decoratedNodeData } from 'components/CytoscapeGraph/CytoscapeGraphUtils';
import FocusAnimation from 'components/CytoscapeGraph/FocusAnimation';

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

const errorStyle = style({
  color: PFAlertColor.Danger
});

const secondaryStyle = style({
  color: PfColors.Black600
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
    const tracesDetailsURL = node.app
      ? `/namespaces/${node.namespace}/applications/${node.app}?tab=traces&${URLParam.JAEGER_TRACE_ID}=${this.props.trace.traceID}`
      : undefined;
    const jaegerTraceURL =
      node.app && this.props.jaegerURL ? `${this.props.jaegerURL}/trace/${this.props.trace.traceID}` : undefined;
    const info = getFormattedTraceInfo(this.props.trace);
    const nameStyleToUse = info.errors ? nameStyle + ' ' + errorStyle : nameStyle;
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
          <Tooltip content={info.name}>
            {tracesDetailsURL ? (
              <Link to={tracesDetailsURL}>
                <span className={nameStyleToUse}>{info.name}</span>
              </Link>
            ) : (
              <span className={nameStyleToUse}>{info.name}</span>
            )}
          </Tooltip>
          {tracesDetailsURL && jaegerTraceURL && (
            <>
              <br />
              <a href={jaegerTraceURL} target="_blank" rel="noopener noreferrer">
                See trace in Jaeger <ExternalLinkAltIcon size="sm" />
              </a>
              <br />
            </>
          )}
          <br />
          <div className={secondaryStyle}>{'ID: ' + this.props.trace.traceID}</div>
          <div className={secondaryStyle}>{'From: ' + info.fromNow}</div>
          {!!info.duration && <div className={secondaryStyle}>{'Full duration: ' + info.duration}</div>}
          {spans && (
            <>
              <br />
              <div className={secondaryStyle}>{'Spans for node: ' + nodeName}</div>
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
              <br />
              {this.state.selectedSpan < spans.length &&
                this.renderSpan(nodeName + '.' + node.namespace, spans[this.state.selectedSpan])}
            </>
          )}
        </div>
      </>
    );
  }

  private renderSpan(nodeFullName: string, span: Span) {
    const info = extractEnvoySpanInfo(span);
    if (info) {
      if (
        nodeFullName !== span.process.serviceName &&
        info.inbound &&
        nodeFullName === info.inbound + '.' + info.otherNamespace
      ) {
        // Special case: this span was added to the inbound workload (this node) while originating from the outbound node.
        // So we need to reverse the logic: it's not an inbound request that we show here, but an outbound request, switching point of view.
        info.inbound = undefined;
        const split = span.process.serviceName.split('.');
        info.outbound = split[0];
        if (split.length > 1) {
          info.otherNamespace = split[1];
        }
      }
      const details: string[] = [];
      if (info.statusCode) {
        details.push('code ' + info.statusCode);
      }
      if (info.responseFlags) {
        details.push('flags ' + info.responseFlags);
      }
      if (span.duration) {
        details.push(formatDuration(span.duration));
      }
      return (
        <>
          {info.inbound && (
            <>
              <span className={secondaryStyle}>{'From: '}</span>
              <Button
                variant={ButtonVariant.link}
                onClick={() => {
                  this.focusOnWorkload(info.otherNamespace!, info.inbound!);
                }}
                isInline
              >
                <span style={{ fontSize: 'var(--graph-side-panel--font-size)' }}>{info.inbound}</span>
              </Button>
            </>
          )}
          {info.outbound && (
            <>
              <span className={secondaryStyle}>{'To: '}</span>
              <Button
                variant={ButtonVariant.link}
                onClick={() => {
                  this.focusOnService(info.otherNamespace!, info.outbound!);
                }}
                isInline
              >
                <span style={{ fontSize: 'var(--graph-side-panel--font-size)' }}>{info.outbound}</span>
              </Button>
            </>
          )}
          <div className={secondaryStyle}>{`Request: ${info.method} ${info.url}`}</div>
          {!!details && <div className={secondaryStyle}>{`Response: [${details.join(', ')}]`}</div>}
          <div className={secondaryStyle}>{`Operation: ${span.operationName}`}</div>
          <div className={secondaryStyle}>{`Started at ${formatDuration(span.relativeStartTime)}`}</div>
          <br />
        </>
      );
    }
    // Else => this is probably a user-defined span
    return (
      <>
        Operation: {span.operationName}
        <br />
        <br />
        Started at +{formatDuration(span.relativeStartTime)}
        <br />
        Duration: {formatDuration(span.duration)}
        <br />
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

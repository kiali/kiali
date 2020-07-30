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

const nameStyle = style({});

const errorStyle = style({
  color: PFAlertColor.Danger
});

const secondaryStyle = style({
  color: PfColors.Black600
});

const navButtonStyle = style({
  paddingTop: 10,
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
      ? `/namespaces/${node.namespace}/services/${node.app}?tab=traces&${URLParam.JAEGER_TRACE_ID}=${this.props.trace.traceID}`
      : undefined;
    const jaegerTraceURL =
      node.app && this.props.jaegerURL ? `${this.props.jaegerURL}/trace/${this.props.trace.traceID}` : undefined;
    const info = getFormattedTraceInfo(this.props.trace);
    const nameStyleToUse = info.errors ? nameStyle + ' ' + errorStyle : nameStyle;
    const nodeName = node.workload || node.service || node.app;
    const spans: Span[] | undefined = this.props.node.data('spans');
    return (
      <>
        <span className={textHeaderStyle}>
          Trace
          {tracesDetailsURL && (
            <>
              {' '}
              (<Link to={tracesDetailsURL}>Details</Link>
              {jaegerTraceURL && (
                <>
                  {' - '}
                  <a href={jaegerTraceURL} target="_blank" rel="noopener noreferrer">
                    Jaeger <ExternalLinkAltIcon size="sm" />
                  </a>
                </>
              )}
              )
            </>
          )}
        </span>
        <span className={closeBoxStyle}>
          <Tooltip content="Close and clear trace selection">
            <Button id="close-trace" variant="plain" onClick={this.props.close}>
              <CloseIcon />
            </Button>
          </Tooltip>
        </span>
        <div>
          <span className={nameStyleToUse}>{info.name}</span>
          <br />
          <span className={secondaryStyle}>
            {this.props.trace.traceID}
            <br />
            {info.fromNow + (info.duration ? ', full duration: ' + info.duration : '')}
            <br />
          </span>
          {spans && (
            <>
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
              <span className={navSpanStyle}>
                Span on {nodeName} {this.state.selectedSpan + 1 + ' / ' + spans.length}
              </span>
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
              {this.state.selectedSpan < spans.length && this.renderSpan(spans[this.state.selectedSpan])}
            </>
          )}
        </div>
      </>
    );
  }

  private renderSpan(span: Span) {
    const info = extractEnvoySpanInfo(span);
    if (info) {
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
          Operation: {span.operationName}
          <br />
          <br />
          Started at +{formatDuration(span.relativeStartTime)}
          <br />
          {info.inbound && (
            <>
              From{' '}
              <Button
                variant="link"
                isInline={true}
                onClick={() => {
                  this.focusOnWorkload(info.otherNamespace!, info.inbound!);
                }}
              >
                {info.inbound}
              </Button>
              {': '}
            </>
          )}
          {info.outbound && (
            <>
              To{' '}
              <Button
                variant="link"
                isInline={true}
                onClick={() => {
                  this.focusOnService(info.otherNamespace!, info.outbound!);
                }}
              >
                {info.outbound}
              </Button>
              {': '}
            </>
          )}
          {info.method} {info.url} {details.length > 0 && ' [' + details.join(', ') + ']'}
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

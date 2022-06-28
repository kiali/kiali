import * as React from 'react';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { style } from 'typestyle';
import { Tooltip, Button, ButtonVariant, pluralize, SelectOption } from '@patternfly/react-core';
import {
  InfoAltIcon,
  CloseIcon,
  ExternalLinkAltIcon,
  ExclamationCircleIcon,
  MapMarkerIcon
} from '@patternfly/react-icons';

import { URLParam } from '../../app/History';
import { JaegerTrace, RichSpanData, EnvoySpanInfo, OpenTracingHTTPInfo, OpenTracingTCPInfo } from 'types/JaegerInfo';
import { KialiAppState } from 'store/Store';
import { KialiAppAction } from 'actions/KialiAppAction';
import { JaegerThunkActions } from 'actions/JaegerThunkActions';
import { GraphActions } from 'actions/GraphActions';
import { PFColors } from 'components/Pf/PfColors';
import { findChildren, findParent, formatDuration } from 'utils/tracing/TracingHelper';
import { CytoscapeGraphSelectorBuilder } from 'components/CytoscapeGraph/CytoscapeGraphSelector';
import { decoratedNodeData } from 'components/CytoscapeGraph/CytoscapeGraphUtils';
import FocusAnimation from 'components/CytoscapeGraph/FocusAnimation';
import { FormattedTraceInfo, shortIDStyle } from 'components/JaegerIntegration/JaegerResults/FormattedTraceInfo';
import SimplerSelect from 'components/SimplerSelect';
import { summaryFont, summaryTitle } from './SummaryPanelCommon';
import { NodeParamsType, GraphType } from 'types/Graph';
import { bindActionCreators } from 'redux';
import responseFlags from 'utils/ResponseFlags';

type Props = {
  trace: JaegerTrace;
  node: any;
  graphType: GraphType;
  jaegerURL?: string;
  close: () => void;
  setNode: (node?: NodeParamsType) => void;
};

type State = {
  selectedSpanID: string | undefined;
};

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

const spanSelectStyle = style({
  $nest: {
    '& > button': {
      fontSize: 'var(--graph-side-panel--font-size)',
      paddingTop: 3,
      paddingBottom: 3
    },
    '& > ul': {
      maxWidth: '100%',
      overflowY: 'hidden'
    },
    '& > ul > li > button': {
      fontSize: 'var(--graph-side-panel--font-size)',
      paddingTop: 3,
      paddingBottom: 3
    }
  }
});

class SummaryPanelTraceDetails extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { selectedSpanID: undefined };
  }

  componentDidUpdate(props: Props) {
    if (props.trace.traceID !== this.props.trace.traceID) {
      this.setState({ selectedSpanID: undefined });
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
    const spans: RichSpanData[] = this.props.node.data('spans') || [];
    let currentSpan = spans.find(s => s.spanID === this.state.selectedSpanID);
    if (!currentSpan && spans.length > 0) {
      currentSpan = spans[0];
    }
    return (
      <>
        <div className={summaryTitle}>
          <span>Trace</span>
          <span className={closeBoxStyle}>
            <Tooltip content="Close and clear trace selection">
              <Button id="close-trace" variant={ButtonVariant.plain} onClick={this.props.close}>
                <CloseIcon />
              </Button>
            </Tooltip>
          </span>
        </div>
        <div>
          {tracesDetailsURL ? (
            <Tooltip content={`View trace details for: ${info.name()}`}>
              <Link to={tracesDetailsURL}>{title}</Link>
            </Tooltip>
          ) : (
            <Tooltip content={`${info.name()}`}>{title}</Tooltip>
          )}
          <div>
            {info.numErrors !== 0 && (
              <>
                <ExclamationCircleIcon color={PFColors.Danger} />{' '}
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
          {spans.length > 0 && (
            <div className={pStyle}>
              <div>
                <strong>{pluralize(spans.length, 'span')}</strong> on this node
                <SimplerSelect
                  selections={currentSpan?.operationName}
                  className={spanSelectStyle}
                  onSelect={key => {
                    this.setState({ selectedSpanID: key as string });
                  }}
                >
                  {spans.map(s => {
                    return (
                      <SelectOption key={s.spanID} value={s.spanID}>
                        {s.operationName} (t + {formatDuration(s.relativeStartTime)})
                      </SelectOption>
                    );
                  })}
                </SimplerSelect>
              </div>
            </div>
          )}
          {currentSpan && <div className={pStyle}>{this.renderSpan(currentSpan)}</div>}
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

  private spanViewLink(span: RichSpanData): string | undefined {
    const node = decoratedNodeData(this.props.node);
    return node.namespace
      ? `/namespaces/${node.namespace}` +
          (node.workload
            ? `/workloads/${node.workload}`
            : node.service
            ? `/services/${node.service}`
            : `/applications/${node.app!}`) +
          `?tab=traces&${URLParam.JAEGER_TRACE_ID}=${this.props.trace.traceID}&${URLParam.JAEGER_SPAN_ID}=${span.spanID}`
      : undefined;
  }

  private renderSpan(span: RichSpanData) {
    const spanURL = this.spanViewLink(span);
    return (
      <>
        <div>
          <strong>Started after: </strong>
          {formatDuration(span.relativeStartTime)}
        </div>
        <div>
          <strong>Duration: </strong>
          {formatDuration(span.duration)}
        </div>
        {(span.type === 'http' || span.type === 'envoy') && this.renderHTTPSpan(span)}
        {span.type === 'tcp' && this.renderTCPSpan(span)}
        <div>
          <strong>Related: </strong>
          {this.renderRelatedSpans(span)}
        </div>
        {spanURL && (
          <div>
            <Link to={spanURL}>Show span</Link>
          </div>
        )}
      </>
    );
  }

  private renderRelatedSpans(span: RichSpanData) {
    type Related = { text: string; span: RichSpanData };
    const parent = findParent(span) as RichSpanData;
    const children = findChildren(span, this.props.trace) as RichSpanData[];
    const related = ((parent ? [{ text: 'parent', span: parent }] : []) as Related[]).concat(
      children.map((child, idx) => ({ text: 'child ' + (idx + 1), span: child }))
    );
    return (
      <>
        {related.length > 0
          ? related.map(r => this.linkToSpan(span, r.span, r.text)).reduce((prev, curr) => [prev, ', ', curr] as any)
          : 'none'}
      </>
    );
  }

  private linkToSpan(current: RichSpanData, target: RichSpanData, text: string) {
    const useApp = this.props.graphType === GraphType.APP || this.props.graphType === GraphType.SERVICE;
    const currentElt = useApp ? current.app : current.workload;
    const targetElt = useApp ? target.app : target.workload;
    let tooltipContent = <>{text}</>;
    if (targetElt) {
      const cy = this.props.node.cy();
      const selBuilder = new CytoscapeGraphSelectorBuilder().namespace(target.namespace).class('span');
      const selector = useApp ? selBuilder.app(targetElt).build() : selBuilder.workload(targetElt).build();
      tooltipContent = (
        <>
          <Button
            variant={ButtonVariant.link}
            onClick={() => {
              this.setState({ selectedSpanID: target.spanID });
              if (targetElt !== currentElt || target.namespace !== current.namespace) {
                cy.elements(selector).trigger('tap');
              }
            }}
            isInline
          >
            <span style={summaryFont}>{text}</span>
          </Button>{' '}
          <Button
            variant={ButtonVariant.link}
            onClick={() => new FocusAnimation(cy).start(cy.elements(selector))}
            isInline
          >
            <span style={summaryFont}>
              <MapMarkerIcon />
            </span>
          </Button>
        </>
      );
    }
    return (
      <Tooltip
        key={target.spanID}
        content={
          <>
            Operation name: {target.operationName}
            <br />
            Workload: {target.workload || 'unknown'}
          </>
        }
      >
        {tooltipContent}
      </Tooltip>
    );
  }

  private renderHTTPSpan(span: RichSpanData) {
    const info = span.info as OpenTracingHTTPInfo | EnvoySpanInfo;
    const rqLabel =
      info.direction === 'inbound' ? 'Inbound request' : info.direction === 'outbound' ? 'Outbound request' : 'Request';
    const flag = (info as EnvoySpanInfo).responseFlags;
    return (
      <>
        <div>
          <strong>{rqLabel}: </strong>
          {info.method} {info.url}
        </div>
        <div>
          <strong>Response: </strong>
          code {info.statusCode || 'unknown'}
          {flag && ', flags ' + flag}
        </div>
        {flag && (
          <div>
            <InfoAltIcon /> {responseFlags[flag]?.help || 'Unknown flag'}
          </div>
        )}
      </>
    );
  }

  private renderTCPSpan(span: RichSpanData) {
    const info = span.info as OpenTracingTCPInfo;
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
  }
}

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  close: () => dispatch(JaegerThunkActions.setTraceId(undefined)),
  setNode: bindActionCreators(GraphActions.setNode, dispatch)
});

const SummaryPanelTraceDetailsContainer = connect(() => ({}), mapDispatchToProps)(SummaryPanelTraceDetails);
export default SummaryPanelTraceDetailsContainer;

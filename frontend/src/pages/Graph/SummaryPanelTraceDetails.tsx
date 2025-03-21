import * as React from 'react';
import { Link } from 'react-router-dom-v5-compat';
import { connect } from 'react-redux';
import { kialiStyle } from 'styles/StyleUtils';
import { Tooltip, Button, ButtonVariant, pluralize } from '@patternfly/react-core';
import { SelectList, SelectOption } from '@patternfly/react-core';
import { URLParam } from '../../app/History';
import { JaegerTrace, RichSpanData, EnvoySpanInfo, OpenTracingHTTPInfo, OpenTracingTCPInfo } from 'types/TracingInfo';
import { KialiAppState } from 'store/Store';
import { TracingThunkActions } from 'actions/TracingThunkActions';
import { GraphActions } from 'actions/GraphActions';
import { PFColors } from 'components/Pf/PfColors';
import { findChildren, findParent, formatDuration } from 'utils/tracing/TracingHelper';
import { FormattedTraceInfo, shortIDStyle } from 'components/TracingIntegration/TracingResults/FormattedTraceInfo';
import { SimpleSelect } from 'components/Select/SimpleSelect';
import { summaryFont, summaryTitle } from './SummaryPanelCommon';
import { NodeParamsType, GraphType, SummaryData, NodeAttr } from 'types/Graph';
import { KialiDispatch } from 'types/Redux';
import { bindActionCreators } from 'redux';
import { responseFlags } from 'utils/ResponseFlags';
import { isParentKiosk, kioskContextMenuAction } from '../../components/Kiosk/KioskActions';
import { Visualization, Node } from '@patternfly/react-topology';
import { elems, selectAnd } from 'helpers/GraphHelpers';
import { FocusNode } from 'pages/Graph/Graph';
import { ExternalServiceInfo } from '../../types/StatusState';
import { isMultiCluster } from '../../config';
import { KialiIcon } from 'config/KialiIcon';
import { GetTracingUrlProvider } from '../../utils/tracing/UrlProviders';

type ReduxStateProps = {
  externalServices: ExternalServiceInfo[];
  kiosk: string;
  provider?: string;
};

type ReduxDispatchProps = {
  close: () => void;
  setNode: (node?: NodeParamsType) => void;
};

type Props = ReduxStateProps &
  ReduxDispatchProps & {
    data: SummaryData;
    graphType: GraphType;
    onFocus?: (focusNode: FocusNode) => void;
    trace: JaegerTrace;
    tracingURL?: string;
  };

type State = {
  selectedSpanID?: string;
};

const closeBoxStyle = kialiStyle({
  float: 'right',
  marginTop: '-0.5rem'
});

const nameStyle = kialiStyle({
  display: 'inline-block',
  maxWidth: '95%',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  whiteSpace: 'nowrap'
});

const pStyle = kialiStyle({
  paddingTop: '0.5rem',
  $nest: {
    '& button': {
      fontSize: 'var(--graph-side-panel--font-size)',
      paddingTop: '0.25rem',
      paddingBottom: '0.25rem'
    }
  }
});

const spanSelectStyle = kialiStyle({
  maxWidth: '100%'
});

const iconStyle = kialiStyle({
  marginRight: '0.25rem'
});

class SummaryPanelTraceDetailsComponent extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { selectedSpanID: undefined };
  }

  componentDidUpdate(props: Props): void {
    if (props.trace.traceID !== this.props.trace.traceID) {
      this.setState({ selectedSpanID: undefined });
    }
  }

  render(): React.ReactNode {
    let node: any = {};
    let nodeData: any = {};

    if (this.props.data.summaryType === 'node') {
      node = this.props.data.summaryTarget;
      nodeData = node.getData();
    }

    const tracesDetailsURL = nodeData.namespace
      ? `/namespaces/${nodeData.namespace}${
          nodeData.workload
            ? `/workloads/${nodeData.workload}`
            : nodeData.service
            ? `/services/${nodeData.service}`
            : `/applications/${nodeData.app!}`
        }?tab=traces&${URLParam.TRACING_TRACE_ID}=${this.props.trace.traceID}${
          nodeData.cluster && isMultiCluster ? `&${URLParam.CLUSTERNAME}=${encodeURIComponent(nodeData.cluster)}` : ''
        }`
      : undefined;

    const tracingURLProvider = GetTracingUrlProvider(this.props.externalServices, this.props.provider);

    const traceUrl = tracingURLProvider?.TraceUrl(this.props.trace);

    const info = new FormattedTraceInfo(this.props.trace);

    const title = (
      <span className={nameStyle}>
        {info.name()}
        <span className={shortIDStyle}>{info.shortID()}</span>
      </span>
    );

    const spans: RichSpanData[] = nodeData['hasSpans'] ?? [];
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
                <KialiIcon.Close />
              </Button>
            </Tooltip>
          </span>
        </div>

        <div>
          {tracesDetailsURL ? (
            <Tooltip content={`View trace details for: ${info.name()}`}>
              <Link
                to={tracesDetailsURL}
                onClick={() => {
                  if (isParentKiosk(this.props.kiosk)) {
                    kioskContextMenuAction(tracesDetailsURL);
                  }
                }}
              >
                {title}
              </Link>
            </Tooltip>
          ) : (
            <Tooltip content={`${info.name()}`}>{title}</Tooltip>
          )}
          <div>
            {info.numErrors !== 0 && (
              <>
                <KialiIcon.ExclamationCircle color={PFColors.Danger} className={iconStyle} />
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
                <SimpleSelect
                  selected={currentSpan?.operationName}
                  className={spanSelectStyle}
                  onSelect={key => {
                    this.setState({ selectedSpanID: key as string });
                  }}
                >
                  <SelectList>
                    {spans.map(s => {
                      return (
                        <SelectOption key={s.spanID} value={s.spanID}>
                          <>
                            <div>{s.operationName}</div>
                            <div>(t + {formatDuration(s.relativeStartTime)})</div>
                          </>
                        </SelectOption>
                      );
                    })}
                  </SelectList>
                </SimpleSelect>
              </div>
            </div>
          )}

          {currentSpan && <div className={pStyle}>{this.renderSpan(currentSpan)}</div>}

          {traceUrl && (
            <div style={{ marginTop: '0.25rem' }}>
              <a href={traceUrl} target="_blank" rel="noopener noreferrer">
                Show in Tracing
                <KialiIcon.ExternalLink className={iconStyle} />
              </a>
            </div>
          )}
        </div>
      </>
    );
  }

  private spanViewLink(span: RichSpanData): string | undefined {
    const node = this.props.data.summaryTarget;
    const nodeData = node.getData();

    return nodeData.namespace
      ? `/namespaces/${nodeData.namespace}${
          nodeData.workload
            ? `/workloads/${nodeData.workload}`
            : nodeData.service
            ? `/services/${nodeData.service}`
            : `/applications/${nodeData.app!}`
        }?tab=traces&${URLParam.TRACING_TRACE_ID}=${this.props.trace.traceID}&${URLParam.TRACING_SPAN_ID}=${
          span.spanID
        }${span.cluster && isMultiCluster ? `&${URLParam.CLUSTERNAME}=${encodeURIComponent(span.cluster)}` : ''}`
      : undefined;
  }

  private renderSpan(span: RichSpanData): React.ReactNode {
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
            <Link
              to={spanURL}
              onClick={() => {
                if (isParentKiosk(this.props.kiosk)) {
                  kioskContextMenuAction(spanURL);
                }
              }}
            >
              Show span
            </Link>
          </div>
        )}
      </>
    );
  }

  private renderRelatedSpans(span: RichSpanData): React.ReactNode {
    type Related = { span: RichSpanData; text: string };
    const parent = findParent(span) as RichSpanData;
    const children = findChildren(span, this.props.trace) as RichSpanData[];

    const related = ((parent ? [{ text: 'parent', span: parent }] : []) as Related[]).concat(
      children.map((child, idx) => ({ text: `child ${idx + 1}`, span: child }))
    );

    return (
      <>
        {related.length > 0
          ? related.map(r => this.linkToSpan(span, r.span, r.text)).reduce((prev, curr) => [prev, ', ', curr] as any)
          : 'none'}
      </>
    );
  }

  private linkToSpan(current: RichSpanData, target: RichSpanData, text: string): React.ReactNode {
    const useApp = this.props.graphType === GraphType.APP || this.props.graphType === GraphType.SERVICE;
    const currentElt = useApp ? current.app : current.workload;
    const targetElt = useApp ? target.app : target.workload;

    let tooltipContent = <>{text}</>;

    if (targetElt) {
      const controller =
        this.props.data.summaryType === 'graph'
          ? (this.props.data.summaryTarget as Visualization)
          : (this.props.data.summaryTarget as Node).getController();

      if (!controller) {
        return <></>;
      }

      const { nodes } = elems(controller);

      const node = selectAnd(nodes, [
        { prop: NodeAttr.namespace, val: target.namespace },
        { prop: 'hasSpans', op: 'truthy' },
        { prop: useApp ? NodeAttr.app : NodeAttr.workload, val: targetElt }
      ]);

      tooltipContent = (
        <>
          <Button
            variant={ButtonVariant.link}
            style={{ marginRight: '0.25rem' }}
            onClick={() => {
              this.setState({ selectedSpanID: target.spanID });
              if (targetElt !== currentElt || target.namespace !== current.namespace) {
                this.props.onFocus!({ id: node[0].getId(), isSelected: true });
              }
            }}
            isInline
          >
            <span style={summaryFont}>{text}</span>
          </Button>

          <Button variant={ButtonVariant.link} onClick={() => this.props.onFocus!({ id: node[0].getId() })} isInline>
            <span style={summaryFont}>
              <KialiIcon.MapMarker />
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
            <div>Operation name: {target.operationName}</div>
            <div>Workload: {target.workload ?? 'unknown'}</div>
          </>
        }
      >
        {tooltipContent}
      </Tooltip>
    );
  }

  private renderHTTPSpan(span: RichSpanData): React.ReactNode {
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
          code {info.statusCode ?? 'unknown'}
          {flag && `, flags ${flag}`}
        </div>

        {flag && (
          <div>
            <KialiIcon.Info /> {responseFlags[flag]?.help ?? 'Unknown flag'}
          </div>
        )}
      </>
    );
  }

  private renderTCPSpan(span: RichSpanData): React.ReactNode {
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

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  externalServices: state.statusState.externalServices,
  kiosk: state.globalState.kiosk,
  provider: state.tracingState.info?.provider
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  close: () => dispatch(TracingThunkActions.setTraceId('', undefined)),
  setNode: bindActionCreators(GraphActions.setNode, dispatch)
});

export const SummaryPanelTraceDetails = connect(mapStateToProps, mapDispatchToProps)(SummaryPanelTraceDetailsComponent);

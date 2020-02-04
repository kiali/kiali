import * as React from 'react';
import { renderDestServicesLinks, renderBadgedLink, renderHealth, renderBadgedHost } from './SummaryLink';
import {
  getAccumulatedTrafficRateGrpc,
  getAccumulatedTrafficRateHttp,
  getTrafficRateGrpc,
  getTrafficRateHttp
} from '../../utils/TrafficRate';
import { InOutRateTableGrpc, InOutRateTableHttp } from '../../components/SummaryPanel/InOutRateTable';
import { RpsChart, TcpChart } from '../../components/SummaryPanel/RpsChart';
import {
  GraphType,
  NodeType,
  SummaryPanelPropType,
  Protocol,
  DecoratedGraphNodeData,
  UNKNOWN
} from '../../types/Graph';
import { Metrics, Metric, Datapoint } from '../../types/Metrics';
import {
  shouldRefreshData,
  updateHealth,
  NodeMetricType,
  getDatapoints,
  getNodeMetrics,
  getNodeMetricType,
  renderNoTraffic,
  mergeMetricsResponses,
  summaryHeader,
  hr,
  summaryPanel
} from './SummaryPanelCommon';
import { Health } from '../../types/Health';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import { Response } from '../../services/Api';
import { Reporter } from '../../types/MetricsOptions';
import { CyNode, decoratedNodeData } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { KialiIcon } from 'config/KialiIcon';
import { getOptions, clickHandler } from 'components/CytoscapeGraph/ContextMenu/NodeContextMenu';
import { Dropdown, DropdownItem, DropdownPosition, KebabToggle } from '@patternfly/react-core';
import { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';

type SummaryPanelNodeMetricsState = {
  grpcRequestCountIn: Datapoint[];
  grpcRequestCountOut: Datapoint[];
  grpcErrorCountIn: Datapoint[];
  grpcErrorCountOut: Datapoint[];
  httpRequestCountIn: Datapoint[] | null;
  httpRequestCountOut: Datapoint[];
  httpErrorCountIn: Datapoint[];
  httpErrorCountOut: Datapoint[];
  tcpSentIn: Datapoint[];
  tcpSentOut: Datapoint[];
  tcpReceivedIn: Datapoint[];
  tcpReceivedOut: Datapoint[];
};

type SummaryPanelNodeState = SummaryPanelNodeMetricsState & {
  node: any;
  loading: boolean;
  healthLoading: boolean;
  health?: Health;
  isOpen: boolean;
  metricsLoadError: string | null;
};

const defaultMetricsState: SummaryPanelNodeMetricsState = {
  grpcRequestCountIn: [],
  grpcRequestCountOut: [],
  grpcErrorCountIn: [],
  grpcErrorCountOut: [],
  httpRequestCountIn: [],
  httpRequestCountOut: [],
  httpErrorCountIn: [],
  httpErrorCountOut: [],
  tcpSentIn: [],
  tcpSentOut: [],
  tcpReceivedIn: [],
  tcpReceivedOut: []
};

const defaultState: SummaryPanelNodeState = {
  node: null,
  loading: false,
  healthLoading: false,
  isOpen: false,
  metricsLoadError: null,
  ...defaultMetricsState
};

type ReduxProps = {
  jaegerIntegration: boolean;
  namespaceSelector: boolean;
  jaegerURL: string;
};

type SummaryPanelNodeProps = ReduxProps & SummaryPanelPropType;

export class SummaryPanelNode extends React.Component<SummaryPanelNodeProps, SummaryPanelNodeState> {
  private metricsPromise?: CancelablePromise<Response<Metrics>[]>;
  private readonly mainDivRef: React.RefObject<HTMLDivElement>;

  constructor(props: SummaryPanelNodeProps) {
    super(props);
    this.showRequestCountMetrics = this.showRequestCountMetrics.bind(this);

    this.state = { ...defaultState };
    this.mainDivRef = React.createRef<HTMLDivElement>();
  }

  static getDerivedStateFromProps(props: SummaryPanelNodeProps, state: SummaryPanelNodeState) {
    // if the summaryTarget (i.e. selected node) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.data.summaryTarget !== state.node
      ? { node: props.data.summaryTarget, loading: true, ...defaultMetricsState }
      : null;
  }

  componentDidMount() {
    this.updateCharts(this.props);
    updateHealth(this.props.data.summaryTarget, this.setState.bind(this));
  }

  componentDidUpdate(prevProps: SummaryPanelNodeProps) {
    if (prevProps.data.summaryTarget !== this.props.data.summaryTarget) {
      if (this.mainDivRef.current) {
        this.mainDivRef.current.scrollTop = 0;
      }
    }
    if (shouldRefreshData(prevProps, this.props)) {
      this.updateCharts(this.props);
      updateHealth(this.props.data.summaryTarget, this.setState.bind(this));
    }
  }

  componentWillUnmount() {
    if (this.metricsPromise) {
      this.metricsPromise.cancel();
    }
  }

  updateCharts(props: SummaryPanelNodeProps) {
    const target = props.data.summaryTarget;
    const nodeData = decoratedNodeData(target);
    const nodeMetricType = getNodeMetricType(nodeData);

    if (this.metricsPromise) {
      this.metricsPromise.cancel();
      this.metricsPromise = undefined;
    }

    if (!this.hasGrpcTraffic(nodeData) && !this.hasHttpTraffic(nodeData) && !this.hasTcpTraffic(nodeData)) {
      this.setState({ loading: false });
      return;
    }

    // If destination node is inaccessible, we cannot query the data.
    if (nodeData.isInaccessible) {
      this.setState({ loading: false });
      return;
    }

    let promiseOut: Promise<Response<Metrics>> = Promise.resolve({ data: { metrics: {}, histograms: {} } });
    let promiseIn: Promise<Response<Metrics>> = Promise.resolve({ data: { metrics: {}, histograms: {} } });

    // Ignore outgoing traffic if it is a non-root outsider (because they have no outgoing edges) or a
    // service node (because they don't have "real" outgoing edges).
    if (nodeData.nodeType !== NodeType.SERVICE && (nodeData.isRoot || !nodeData.isOutside)) {
      const filters = ['request_count', 'request_error_count', 'tcp_sent', 'tcp_received'];
      // use source metrics for outgoing, except for:
      // - unknown nodes (no source telemetry)
      // - istio namespace nodes (no source telemetry)
      const reporter: Reporter = nodeData.nodeType === NodeType.UNKNOWN || nodeData.isIstio ? 'destination' : 'source';
      // note: request_protocol is not a valid byLabel for tcp filters but it is ignored by prometheus
      const byLabels = nodeData.isRoot ? ['destination_service_namespace', 'request_protocol'] : ['request_protocol'];
      promiseOut = getNodeMetrics(
        nodeMetricType,
        target,
        props,
        filters,
        'outbound',
        reporter,
        undefined,
        undefined,
        byLabels
      );
    }

    // set incoming unless it is a root (because they have no incoming edges)
    if (!nodeData.isRoot) {
      const filtersRps = ['request_count', 'request_error_count'];
      // use dest metrics for incoming, except for service nodes which need source metrics to capture source errors
      const reporter: Reporter = nodeData.nodeType === NodeType.SERVICE && nodeData.isIstio ? 'source' : 'destination';
      // For special service dest nodes we want to narrow the data to only TS with 'unknown' workloads (see the related
      // comparator in getNodeDatapoints).
      const isServiceDestCornerCase = this.isServiceDestCornerCase(nodeMetricType);
      const byLabelsRps = isServiceDestCornerCase ? ['destination_workload', 'request_protocol'] : ['request_protocol'];
      const promiseRps = getNodeMetrics(
        nodeMetricType,
        target,
        props,
        filtersRps,
        'inbound',
        reporter,
        undefined,
        undefined,
        byLabelsRps
      );
      const filtersTCP = ['tcp_sent', 'tcp_received'];
      const byLabelsTCP = isServiceDestCornerCase ? ['destination_workload'] : undefined;
      const promiseTCP = getNodeMetrics(
        nodeMetricType,
        target,
        props,
        filtersTCP,
        'inbound',
        'source',
        undefined,
        undefined,
        byLabelsTCP
      );
      promiseIn = mergeMetricsResponses([promiseRps, promiseTCP]);
    }

    this.metricsPromise = makeCancelablePromise(Promise.all([promiseOut, promiseIn]));
    this.metricsPromise.promise
      .then(responses => {
        this.showRequestCountMetrics(responses[0].data, responses[1].data, nodeData, nodeMetricType);
      })
      .catch(error => {
        if (error.isCanceled) {
          console.debug('SummaryPanelNode: Ignore fetch error (canceled).');
          return;
        }
        const errorMsg = error.response && error.response.data.error ? error.response.data.error : error.message;
        this.setState({
          loading: false,
          metricsLoadError: errorMsg,
          ...defaultMetricsState
        });
      });

    this.setState({ loading: true, metricsLoadError: null });
  }

  showRequestCountMetrics(
    outbound: Metrics,
    inbound: Metrics,
    data: DecoratedGraphNodeData,
    nodeMetricType: NodeMetricType
  ) {
    let comparator = (metric: Metric, protocol?: Protocol) => {
      return protocol ? metric.request_protocol === protocol : true;
    };
    if (this.isServiceDestCornerCase(nodeMetricType)) {
      comparator = (metric: Metric, protocol?: Protocol) => {
        return (protocol ? metric.request_protocol === protocol : true) && metric.destination_workload === UNKNOWN;
      };
    } else if (data.isRoot) {
      comparator = (metric: Metric, protocol?: Protocol) => {
        return (
          (protocol ? metric.request_protocol === protocol : true) &&
          this.isActiveNamespace(metric.destination_service_namespace)
        );
      };
    }
    const rcOut = outbound.metrics.request_count;
    const ecOut = outbound.metrics.request_error_count;
    const tcpSentOut = outbound.metrics.tcp_sent;
    const tcpReceivedOut = outbound.metrics.tcp_received;
    const rcIn = inbound.metrics.request_count;
    const ecIn = inbound.metrics.request_error_count;
    const tcpSentIn = inbound.metrics.tcp_sent;
    const tcpReceivedIn = inbound.metrics.tcp_received;
    this.setState({
      loading: false,
      grpcRequestCountOut: getDatapoints(rcOut, comparator, Protocol.GRPC),
      grpcErrorCountOut: getDatapoints(ecOut, comparator, Protocol.GRPC),
      grpcRequestCountIn: getDatapoints(rcIn, comparator, Protocol.GRPC),
      grpcErrorCountIn: getDatapoints(ecIn, comparator, Protocol.GRPC),
      httpRequestCountOut: getDatapoints(rcOut, comparator, Protocol.HTTP),
      httpErrorCountOut: getDatapoints(ecOut, comparator, Protocol.HTTP),
      httpRequestCountIn: getDatapoints(rcIn, comparator, Protocol.HTTP),
      httpErrorCountIn: getDatapoints(ecIn, comparator, Protocol.HTTP),
      tcpSentOut: getDatapoints(tcpSentOut, comparator),
      tcpReceivedOut: getDatapoints(tcpReceivedOut, comparator),
      tcpSentIn: getDatapoints(tcpSentIn, comparator),
      tcpReceivedIn: getDatapoints(tcpReceivedIn, comparator)
    });
  }

  isActiveNamespace = (namespace: string): boolean => {
    if (!namespace) {
      return false;
    }
    for (const ns of this.props.namespaces) {
      if (ns.name === namespace) {
        return true;
      }
    }
    return false;
  };

  render() {
    const node = this.props.data.summaryTarget;
    const nodeData = decoratedNodeData(node);
    const { nodeType, workload, isServiceEntry } = nodeData;
    const servicesList = nodeType !== NodeType.SERVICE && renderDestServicesLinks(node);
    const destsList = nodeType === NodeType.SERVICE && isServiceEntry && this.renderDestServices(nodeData);

    const shouldRenderDestsList = destsList && destsList.length > 0;
    const shouldRenderSvcList = servicesList && servicesList.length > 0;
    const shouldRenderWorkload = nodeType !== NodeType.WORKLOAD && nodeType !== NodeType.UNKNOWN && workload;

    const actions = getOptions(
      nodeData,
      this.props.namespaceSelector,
      this.props.jaegerIntegration,
      this.props.jaegerURL
    ).map(o => {
      return (
        <DropdownItem key={o.text} onClick={() => clickHandler(o)}>
          {o.text}
        </DropdownItem>
      );
    });

    return (
      <div ref={this.mainDivRef} className={`panel panel-default ${summaryPanel}`}>
        <div className="panel-heading" style={summaryHeader}>
          <div>
            {renderBadgedLink(nodeData)}
            <Dropdown
              id="summary-node-actions"
              style={{ float: 'right' }}
              isPlain={true}
              dropdownItems={actions}
              isOpen={this.state.isOpen}
              position={DropdownPosition.right}
              toggle={<KebabToggle id="summary-node-kebab" onToggle={this.onToggleActions} />}
            />
          </div>
          <div>{renderHealth(this.state.health)}</div>
          <div>
            {this.renderBadgeSummary(nodeData.hasCB, nodeData.hasVS, nodeData.hasMissingSC, nodeData.isDead)}
            {shouldRenderDestsList && <div>{destsList}</div>}
            {shouldRenderSvcList && <div>{servicesList}</div>}
            {shouldRenderWorkload && <div>{renderBadgedLink(nodeData, NodeType.WORKLOAD)}</div>}
          </div>
        </div>
        <div className="panel-body">
          {this.hasGrpcTraffic(nodeData) && (
            <>
              {this.renderGrpcRates(node)}
              {hr()}
            </>
          )}
          {this.hasHttpTraffic(nodeData) && (
            <>
              {this.renderHttpRates(node)}
              {hr()}
            </>
          )}
          <div>
            {this.renderCharts(node)}
            {hr()}
          </div>
          {!this.hasGrpcTraffic(nodeData) && renderNoTraffic('GRPC')}
          {!this.hasHttpTraffic(nodeData) && renderNoTraffic('HTTP')}
        </div>
      </div>
    );
  }

  private onToggleActions = isOpen => {
    this.setState({ isOpen: isOpen });
  };

  private renderGrpcRates = node => {
    const incoming = getTrafficRateGrpc(node);
    const outgoing = getAccumulatedTrafficRateGrpc(this.props.data.summaryTarget.edgesTo('*'));

    return (
      <>
        <InOutRateTableGrpc
          title="GRPC Traffic (requests per second):"
          inRate={incoming.rate}
          inRateErr={incoming.rateErr}
          outRate={outgoing.rate}
          outRateErr={outgoing.rateErr}
        />
      </>
    );
  };

  private renderHttpRates = node => {
    const incoming = getTrafficRateHttp(node);
    const outgoing = getAccumulatedTrafficRateHttp(this.props.data.summaryTarget.edgesTo('*'));

    return (
      <>
        <InOutRateTableHttp
          title="HTTP (requests per second):"
          inRate={incoming.rate}
          inRate3xx={incoming.rate3xx}
          inRate4xx={incoming.rate4xx}
          inRate5xx={incoming.rate5xx}
          outRate={outgoing.rate}
          outRate3xx={outgoing.rate3xx}
          outRate4xx={outgoing.rate4xx}
          outRate5xx={outgoing.rate5xx}
        />
      </>
    );
  };

  private renderCharts = node => {
    const nodeData = decoratedNodeData(node);

    if (NodeType.UNKNOWN === nodeData.nodeType) {
      return (
        <>
          <div>
            <KialiIcon.Info /> Sparkline charts not supported for unknown node. Use edge for details.
          </div>
        </>
      );
    } else if (nodeData.isInaccessible) {
      return (
        <>
          <div>
            <KialiIcon.Info /> Sparkline charts cannot be shown because the selected node is inaccessible.
          </div>
        </>
      );
    } else if (nodeData.isServiceEntry) {
      return (
        <>
          <div>
            <KialiIcon.Info /> Sparkline charts cannot be shown because the selected node is a serviceEntry.
          </div>
        </>
      );
    }
    if (this.state.loading) {
      return <strong>Loading charts...</strong>;
    }
    if (this.state.metricsLoadError) {
      return (
        <div>
          <KialiIcon.Warning /> <strong>Error loading metrics: </strong>
          {this.state.metricsLoadError}
        </div>
      );
    }

    const isServiceNode = nodeData.nodeType === NodeType.SERVICE;
    let serviceWithUnknownSource: boolean = false;
    if (isServiceNode) {
      node.incomers().forEach(n => {
        if (NodeType.UNKNOWN === n.data(CyNode.nodeType)) {
          serviceWithUnknownSource = true;
          return false; // Equivalent of break for cytoscapejs forEach API
        }
        return undefined; // Every code paths needs to return something to avoid the wrath of the linter.
      });
    }

    let grpcCharts, httpCharts, tcpCharts;

    if (this.hasGrpcTraffic(nodeData)) {
      grpcCharts = (
        <>
          <RpsChart
            label={isServiceNode ? 'GRPC - Request Traffic' : 'GRPC - Inbound Request Traffic'}
            dataRps={this.state.grpcRequestCountIn!}
            dataErrors={this.state.grpcErrorCountIn}
          />
          {serviceWithUnknownSource && (
            <>
              <div>
                <KialiIcon.Info /> Traffic from unknown not included. Use edge for details.
              </div>
            </>
          )}
          <RpsChart
            label="GRPC - Outbound Request Traffic"
            dataRps={this.state.grpcRequestCountOut}
            dataErrors={this.state.grpcErrorCountOut}
            hide={isServiceNode}
          />
          {this.isIstioOutgoingCornerCase(node) && (
            <>
              <div>
                <KialiIcon.Info /> Traffic to Istio namespaces not included. Use edge for details.
              </div>
            </>
          )}
        </>
      );
    }

    if (this.hasHttpTraffic(nodeData)) {
      httpCharts = (
        <>
          <RpsChart
            label={isServiceNode ? 'HTTP - Request Traffic' : 'HTTP - Inbound Request Traffic'}
            dataRps={this.state.httpRequestCountIn!}
            dataErrors={this.state.httpErrorCountIn}
          />
          {serviceWithUnknownSource && (
            <>
              <div>
                <KialiIcon.Info /> Traffic from unknown not included. Use edge for details.
              </div>
            </>
          )}
          <RpsChart
            label="HTTP - Outbound Request Traffic"
            dataRps={this.state.httpRequestCountOut}
            dataErrors={this.state.httpErrorCountOut}
            hide={isServiceNode}
          />
          {this.isIstioOutgoingCornerCase(node) && (
            <>
              <div>
                <KialiIcon.Info />" /> Traffic to Istio namespaces not included. Use edge for details.
              </div>
            </>
          )}
        </>
      );
    }

    if (this.hasTcpTraffic(nodeData)) {
      tcpCharts = (
        <>
          <TcpChart
            label={isServiceNode ? 'TCP - Traffic' : 'TCP - Inbound Traffic'}
            receivedRates={this.state.tcpReceivedIn}
            sentRates={this.state.tcpSentIn}
          />
          <TcpChart
            label="TCP - Outbound Traffic"
            receivedRates={this.state.tcpReceivedOut}
            sentRates={this.state.tcpSentOut}
            hide={isServiceNode}
          />
        </>
      );
    }

    return (
      <>
        {grpcCharts}
        {httpCharts}
        {tcpCharts}
      </>
    );
  };

  // TODO:(see https://github.com/kiali/kiali-design/issues/63) If we want to show an icon for SE uncomment below
  private renderBadgeSummary = (hasCB?: boolean, hasVS?: boolean, hasMissingSC?: boolean, isDead?: boolean) => {
    return (
      <div style={{ marginTop: '10px', marginBottom: '10px' }}>
        {hasCB && (
          <div>
            <KialiIcon.CircuitBreaker />
            <span style={{ paddingLeft: '4px' }}>Has Circuit Breaker</span>
          </div>
        )}
        {hasVS && (
          <div>
            <KialiIcon.VirtualService />
            <span style={{ paddingLeft: '4px' }}>Has Virtual Service</span>
          </div>
        )}
        {hasMissingSC && (
          <div>
            <KialiIcon.MissingSidecar />
            <span style={{ paddingLeft: '4px' }}>Has Missing Sidecar</span>
          </div>
        )}
        {isDead && (
          <div>
            <span style={{ marginRight: '5px' }}>
              <KialiIcon.Info />
            </span>
            <span style={{ paddingLeft: '4px' }}>Has No Running Pods</span>
          </div>
        )}
      </div>
    );
  };

  private renderDestServices = (data: DecoratedGraphNodeData) => {
    const destServices = data.destServices;

    const entries: any[] = [];
    if (!destServices) {
      return entries;
    }

    destServices.forEach(ds => {
      const service = ds.name;
      const displayName = service;
      entries.push(renderBadgedHost(displayName));
    });

    return entries;
  };

  // We need to handle the special case of a dest service node showing client failures. These service nodes show up in
  // non-service graphs, even when not injecting service nodes.
  private isServiceDestCornerCase = (nodeMetricType: NodeMetricType): boolean => {
    return (
      nodeMetricType === NodeMetricType.SERVICE &&
      !this.props.injectServiceNodes &&
      this.props.graphType !== GraphType.SERVICE
    );
  };

  // We need to handle the special case of a non-istio, non-unknown node with outgoing traffic to istio.
  // The traffic is lost because it is dest-only and we use source-reporting.
  private isIstioOutgoingCornerCase = (node): boolean => {
    const nodeData = decoratedNodeData(node);
    if (nodeData.nodeType === NodeType.UNKNOWN || nodeData.isIstio) {
      return false;
    }
    return node.edgesTo(`node[?${CyNode.isIstio}]`).size() > 0;
  };

  private hasGrpcTraffic = (data: DecoratedGraphNodeData): boolean => {
    return data.grpcIn > 0 || data.grpcOut > 0;
  };

  private hasHttpTraffic = (data: DecoratedGraphNodeData): boolean => {
    return data.httpIn > 0 || data.httpOut > 0;
  };

  private hasTcpTraffic = (data: DecoratedGraphNodeData): boolean => {
    return data.tcpIn > 0 || data.tcpOut > 0;
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  jaegerIntegration: state.jaegerState ? state.jaegerState.integration : false,
  namespaceSelector: state.jaegerState ? state.jaegerState.namespaceSelector : true,
  jaegerURL: state.jaegerState ? state.jaegerState.jaegerURL : ''
});

const SummaryPanelNodeContainer = connect(mapStateToProps)(SummaryPanelNode);
export default SummaryPanelNodeContainer;

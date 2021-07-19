import * as React from 'react';
import {
  getAccumulatedTrafficRateGrpc,
  getAccumulatedTrafficRateHttp,
  getTrafficRateGrpc,
  getTrafficRateHttp
} from '../../utils/TrafficRate';
import { InOutRateTableGrpc, InOutRateTableHttp } from '../../components/SummaryPanel/InOutRateTable';
import { RequestChart, StreamChart } from '../../components/SummaryPanel/RpsChart';
import {
  GraphType,
  NodeType,
  SummaryPanelPropType,
  Protocol,
  DecoratedGraphNodeData,
  UNKNOWN,
  TrafficRate
} from '../../types/Graph';
import { IstioMetricsMap, Datapoint, Labels } from '../../types/Metrics';
import {
  shouldRefreshData,
  NodeMetricType,
  getDatapoints,
  getNodeMetrics,
  getNodeMetricType,
  renderNoTraffic,
  mergeMetricsResponses,
  hr
} from './SummaryPanelCommon';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import { Response } from '../../services/Api';
import { Reporter } from '../../types/MetricsOptions';
import { CyNode, decoratedNodeData } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { KialiIcon } from 'config/KialiIcon';

type SummaryPanelNodeMetricsState = {
  grpcRequestCountIn: Datapoint[];
  grpcRequestCountOut: Datapoint[];
  grpcErrorCountIn: Datapoint[];
  grpcErrorCountOut: Datapoint[];
  grpcSentIn: Datapoint[];
  grpcSentOut: Datapoint[];
  grpcReceivedIn: Datapoint[];
  grpcReceivedOut: Datapoint[];
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
  metricsLoadError: string | null;
};

const defaultMetricsState: SummaryPanelNodeMetricsState = {
  grpcRequestCountIn: [],
  grpcRequestCountOut: [],
  grpcErrorCountIn: [],
  grpcErrorCountOut: [],
  grpcSentIn: [],
  grpcSentOut: [],
  grpcReceivedIn: [],
  grpcReceivedOut: [],
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
  metricsLoadError: null,
  ...defaultMetricsState
};

type SummaryPanelNodeProps = SummaryPanelPropType;

export class SummaryPanelNodeTraffic extends React.Component<SummaryPanelNodeProps, SummaryPanelNodeState> {
  private metricsPromise?: CancelablePromise<Response<IstioMetricsMap>[]>;

  constructor(props: SummaryPanelNodeProps) {
    super(props);
    this.showTrafficMetrics = this.showTrafficMetrics.bind(this);

    this.state = { ...defaultState };
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
  }

  componentDidUpdate(prevProps: SummaryPanelNodeProps) {
    if (shouldRefreshData(prevProps, this.props)) {
      this.updateCharts(this.props);
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
    const isGrpcRequests = this.isGrpcRequests();

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

    let promiseIn: Promise<Response<IstioMetricsMap>> = Promise.resolve({ data: {} });
    let promiseOut: Promise<Response<IstioMetricsMap>> = Promise.resolve({ data: {} });

    // set inbound unless it is a root (because they have no inbound edges)
    if (!nodeData.isRoot) {
      const isServiceDestCornerCase = this.isServiceDestCornerCase(nodeMetricType);
      let promiseRps: Promise<Response<IstioMetricsMap>> = Promise.resolve({ data: {} });
      let promiseStream: Promise<Response<IstioMetricsMap>> = Promise.resolve({ data: {} });

      if (this.hasHttpIn(nodeData) || (this.hasGrpcIn(nodeData) && isGrpcRequests)) {
        const filtersRps = ['request_count', 'request_error_count'];
        // use dest metrics for inbound, except for service nodes which need source metrics to capture source errors
        const reporter: Reporter =
          nodeData.nodeType === NodeType.SERVICE && nodeData.isIstio ? 'source' : 'destination';
        // For special service dest nodes we want to narrow the data to only TS with 'unknown' workloads (see the related
        // comparator in getNodeDatapoints).

        const byLabelsRps = isServiceDestCornerCase
          ? ['destination_workload', 'request_protocol']
          : ['request_protocol'];
        if (nodeData.isOutside) {
          byLabelsRps.push('source_workload_namespace');
        }
        promiseRps = getNodeMetrics(
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
      }

      // Aggregate nodes currently only deal with request traffic
      if (nodeData.nodeType !== NodeType.AGGREGATE) {
        const filtersStream = [] as string[];
        if (this.hasGrpcIn(nodeData)) {
          filtersStream.push('grpc_sent', 'grpc_received');
        }
        if (this.hasTcpIn(nodeData)) {
          filtersStream.push('tcp_sent', 'tcp_received');
        }
        if (filtersStream.length > 0) {
          const byLabelsStream = isServiceDestCornerCase ? ['destination_workload'] : [];
          if (nodeData.isOutside) {
            byLabelsStream.push('source_workload_namespace');
          }
          promiseStream = getNodeMetrics(
            nodeMetricType,
            target,
            props,
            filtersStream,
            'inbound',
            'source',
            undefined,
            undefined,
            byLabelsStream
          );
        }
      }

      promiseIn = mergeMetricsResponses([promiseRps, promiseStream]);
    }

    // Ignore outbound traffic if it is a non-root outsider (because they have no outbound edges) or a
    // service node or aggregate node (because they don't have "real" outbound edges).
    if (
      !([NodeType.SERVICE, NodeType.AGGREGATE].includes(nodeData.nodeType) || (nodeData.isOutside && !nodeData.isRoot))
    ) {
      const filters = [] as string[];
      if (this.hasHttpOut(nodeData) || (this.hasGrpcOut(nodeData) && isGrpcRequests)) {
        filters.push('request_count', 'request_error_count');
      }
      if (this.hasGrpcOut(nodeData) && !isGrpcRequests) {
        filters.push('grpc_sent', 'grpc_received');
      }
      if (this.hasTcpOut(nodeData)) {
        filters.push('tcp_sent', 'tcp_received');
      }

      if (filters.length > 0) {
        // use source metrics for outbound, except for:
        // - unknown nodes (no source telemetry)
        // - istio namespace nodes (no source telemetry)
        const reporter: Reporter =
          nodeData.nodeType === NodeType.UNKNOWN || nodeData.isIstio ? 'destination' : 'source';
        // note: request_protocol is not a valid byLabel for tcp filters but it is ignored by prometheus
        const byLabels = nodeData.isOutside
          ? ['destination_service_namespace', 'request_protocol']
          : ['request_protocol'];
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
    }

    this.metricsPromise = makeCancelablePromise(Promise.all([promiseOut, promiseIn]));
    this.metricsPromise.promise
      .then(responses => {
        this.showTrafficMetrics(responses[0].data, responses[1].data, nodeData, nodeMetricType);
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

  showTrafficMetrics(
    outbound: IstioMetricsMap,
    inbound: IstioMetricsMap,
    data: DecoratedGraphNodeData,
    nodeMetricType: NodeMetricType
  ) {
    let comparator = (labels: Labels, protocol?: Protocol) => {
      return protocol ? labels.request_protocol === protocol : true;
    };
    if (this.isServiceDestCornerCase(nodeMetricType)) {
      comparator = (labels: Labels, protocol?: Protocol) => {
        return (protocol ? labels.request_protocol === protocol : true) && labels.destination_workload === UNKNOWN;
      };
    } else if (data.isOutside) {
      // filter out traffic completely outside the active namespaces
      comparator = (labels: Labels, protocol?: Protocol) => {
        if (protocol && labels.request_protocol !== protocol) {
          return false;
        }
        if (labels.destination_service_namespace && !this.isActiveNamespace(labels.destination_service_namespace)) {
          return false;
        }
        if (labels.source_workload_namespace && !this.isActiveNamespace(labels.source_workload_namespace)) {
          return false;
        }
        return true;
      };
    }
    const rcOut = outbound.request_count;
    const ecOut = outbound.request_error_count;
    const grpcSentOut = outbound.grpc_sent;
    const grpcReceivedOut = outbound.grpc_received;
    const tcpSentOut = outbound.tcp_sent;
    const tcpReceivedOut = outbound.tcp_received;
    const rcIn = inbound.request_count;
    const ecIn = inbound.request_error_count;
    const grpcSentIn = inbound.grpc_sent;
    const grpcReceivedIn = inbound.grpc_received;
    const tcpSentIn = inbound.tcp_sent;
    const tcpReceivedIn = inbound.tcp_received;
    this.setState({
      loading: false,
      grpcErrorCountIn: getDatapoints(ecIn, comparator, Protocol.GRPC),
      grpcErrorCountOut: getDatapoints(ecOut, comparator, Protocol.GRPC),
      grpcReceivedIn: getDatapoints(grpcReceivedIn, comparator),
      grpcReceivedOut: getDatapoints(grpcReceivedOut, comparator),
      grpcRequestCountIn: getDatapoints(rcIn, comparator, Protocol.GRPC),
      grpcRequestCountOut: getDatapoints(rcOut, comparator, Protocol.GRPC),
      grpcSentIn: getDatapoints(grpcSentIn, comparator),
      grpcSentOut: getDatapoints(grpcSentOut, comparator),
      httpErrorCountIn: getDatapoints(ecIn, comparator, Protocol.HTTP),
      httpErrorCountOut: getDatapoints(ecOut, comparator, Protocol.HTTP),
      httpRequestCountIn: getDatapoints(rcIn, comparator, Protocol.HTTP),
      httpRequestCountOut: getDatapoints(rcOut, comparator, Protocol.HTTP),
      tcpReceivedIn: getDatapoints(tcpReceivedIn, comparator),
      tcpReceivedOut: getDatapoints(tcpReceivedOut, comparator),
      tcpSentIn: getDatapoints(tcpSentIn, comparator),
      tcpSentOut: getDatapoints(tcpSentOut, comparator)
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
    const hasGrpc = this.hasGrpcTraffic(nodeData);
    const hasGrpcIn = hasGrpc && this.hasGrpcIn(nodeData);
    const hasGrpcOut = hasGrpc && this.hasGrpcOut(nodeData);
    const hasHttp = this.hasHttpTraffic(nodeData);
    const hasHttpIn = hasHttp && this.hasHttpIn(nodeData);
    const hasHttpOut = hasHttp && this.hasHttpOut(nodeData);
    const hasTcp = this.hasTcpTraffic(nodeData);
    const hasTcpIn = hasTcp && this.hasTcpIn(nodeData);
    const hasTcpOut = hasTcp && this.hasTcpOut(nodeData);

    return (
      <>
        {hasGrpc && this.isGrpcRequests() && (
          <>
            {this.renderGrpcRates(node)}
            {hr()}
          </>
        )}
        {hasHttp && (
          <>
            {this.renderHttpRates(node)}
            {hr()}
          </>
        )}
        <div>
          {this.renderSparklines(node)}
          {hr()}
        </div>
        {hasGrpc && !hasGrpcIn && renderNoTraffic('gRPC inbound')}
        {hasGrpc && !hasGrpcOut && renderNoTraffic('gRPC outbound')}
        {!hasGrpc && renderNoTraffic('gRPC')}
        {hasHttp && !hasHttpIn && renderNoTraffic('HTTP inbound')}
        {hasHttp && !hasHttpOut && renderNoTraffic('HTTP outbound')}
        {!hasHttp && renderNoTraffic('HTTP')}
        {hasTcp && !hasTcpIn && renderNoTraffic('TCP inbound')}
        {hasTcp && !hasTcpOut && renderNoTraffic('TCP outbound')}
        {!hasTcp && renderNoTraffic('TCP')}
      </>
    );
  }

  private renderGrpcRates = node => {
    const inbound = getTrafficRateGrpc(node);
    const outbound = getAccumulatedTrafficRateGrpc(this.props.data.summaryTarget.edgesTo('*'));

    return (
      <>
        <InOutRateTableGrpc
          title="gRPC Traffic (requests per second):"
          inRate={inbound.rate}
          inRateGrpcErr={inbound.rateGrpcErr}
          inRateNR={inbound.rateNoResponse}
          outRate={outbound.rate}
          outRateGrpcErr={outbound.rateGrpcErr}
          outRateNR={outbound.rateNoResponse}
        />
      </>
    );
  };

  private renderHttpRates = node => {
    const inbound = getTrafficRateHttp(node);
    const outbound = getAccumulatedTrafficRateHttp(this.props.data.summaryTarget.edgesTo('*'));

    return (
      <>
        <InOutRateTableHttp
          title="HTTP (requests per second):"
          inRate={inbound.rate}
          inRate3xx={inbound.rate3xx}
          inRate4xx={inbound.rate4xx}
          inRate5xx={inbound.rate5xx}
          inRateNR={inbound.rateNoResponse}
          outRate={outbound.rate}
          outRate3xx={outbound.rate3xx}
          outRate4xx={outbound.rate4xx}
          outRate5xx={outbound.rate5xx}
          outRateNR={outbound.rateNoResponse}
        />
      </>
    );
  };

  private renderSparklines = node => {
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
    const isInOutSameNode = isServiceNode || nodeData.nodeType === NodeType.AGGREGATE;
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
      grpcCharts = this.isGrpcRequests() ? (
        <>
          {this.hasGrpcIn(nodeData) && (
            <>
              <RequestChart
                label={isInOutSameNode ? 'gRPC - Request Traffic' : 'gRPC - Inbound Request Traffic'}
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
            </>
          )}
          {this.hasGrpcIn(nodeData) && (
            <>
              <RequestChart
                label="gRPC - Outbound Request Traffic"
                dataRps={this.state.grpcRequestCountOut}
                dataErrors={this.state.grpcErrorCountOut}
                hide={isInOutSameNode}
              />
              {this.isIstioOutboundCornerCase(node) && (
                <>
                  <div>
                    <KialiIcon.Info /> Traffic to Istio namespaces not included. Use edge for details.
                  </div>
                </>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {this.hasGrpcIn(nodeData) && (
            <StreamChart
              label={isInOutSameNode ? 'gRPC - Traffic' : 'gRPC - Inbound Traffic'}
              receivedRates={this.state.grpcReceivedIn}
              sentRates={this.state.grpcSentIn}
              unit="messages"
            />
          )}
          {this.hasGrpcOut(nodeData) && (
            <StreamChart
              label="gRPC - Outbound Traffic"
              receivedRates={this.state.grpcReceivedOut}
              sentRates={this.state.grpcSentOut}
              hide={isInOutSameNode}
              unit="messages"
            />
          )}
        </>
      );
    }

    if (this.hasHttpTraffic(nodeData)) {
      httpCharts = (
        <>
          {this.hasHttpIn(nodeData) && (
            <>
              <RequestChart
                label={isInOutSameNode ? 'HTTP - Request Traffic' : 'HTTP - Inbound Request Traffic'}
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
            </>
          )}
          {this.hasHttpOut(nodeData) && (
            <>
              <RequestChart
                label="HTTP - Outbound Request Traffic"
                dataRps={this.state.httpRequestCountOut}
                dataErrors={this.state.httpErrorCountOut}
                hide={isInOutSameNode}
              />
              {this.isIstioOutboundCornerCase(node) && (
                <>
                  <div>
                    <KialiIcon.Info />" Traffic to Istio namespaces not included. Use edge for details.
                  </div>
                </>
              )}
            </>
          )}
        </>
      );
    }

    if (this.hasTcpTraffic(nodeData)) {
      tcpCharts = (
        <>
          {this.hasTcpIn(nodeData) && (
            <StreamChart
              label={isInOutSameNode ? 'TCP - Traffic' : 'TCP - Inbound Traffic'}
              receivedRates={this.state.tcpReceivedIn}
              sentRates={this.state.tcpSentIn}
              unit="bytes"
            />
          )}
          {this.hasTcpOut(nodeData) && (
            <StreamChart
              label="TCP - Outbound Traffic"
              receivedRates={this.state.tcpReceivedOut}
              sentRates={this.state.tcpSentOut}
              hide={isInOutSameNode}
              unit="bytes"
            />
          )}
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

  // We need to handle the special case of a dest service node showing client failures. These service nodes show up in
  // non-service graphs, even when not injecting service nodes.
  private isServiceDestCornerCase = (nodeMetricType: NodeMetricType): boolean => {
    return (
      nodeMetricType === NodeMetricType.SERVICE &&
      !this.props.injectServiceNodes &&
      this.props.graphType !== GraphType.SERVICE
    );
  };

  // We need to handle the special case of a non-istio, non-unknown node with outbound traffic to istio.
  // The traffic is lost because it is dest-only and we use source-reporting.
  private isIstioOutboundCornerCase = (node): boolean => {
    const nodeData = decoratedNodeData(node);
    if (nodeData.nodeType === NodeType.UNKNOWN || nodeData.isIstio) {
      return false;
    }
    return node.edgesTo(`node[?${CyNode.isIstio}]`).size() > 0;
  };

  private hasGrpcTraffic = (data: DecoratedGraphNodeData): boolean => {
    return this.hasGrpcIn(data) || this.hasGrpcOut(data);
  };

  private isGrpcRequests = (): boolean => {
    return this.props.trafficRates.includes(TrafficRate.GRPC_REQUEST);
  };

  private hasHttpTraffic = (data: DecoratedGraphNodeData): boolean => {
    return this.hasHttpIn(data) || this.hasHttpOut(data);
  };

  private hasTcpTraffic = (data: DecoratedGraphNodeData): boolean => {
    return this.hasTcpIn(data) || this.hasTcpOut(data);
  };

  private hasGrpcIn = (data: DecoratedGraphNodeData): boolean => {
    return data.grpcIn > 0;
  };

  private hasHttpIn = (data: DecoratedGraphNodeData): boolean => {
    return data.httpIn > 0;
  };

  private hasTcpIn = (data: DecoratedGraphNodeData): boolean => {
    return data.tcpIn > 0;
  };

  private hasGrpcOut = (data: DecoratedGraphNodeData): boolean => {
    return data.grpcOut > 0;
  };

  private hasHttpOut = (data: DecoratedGraphNodeData): boolean => {
    return data.httpOut > 0;
  };

  private hasTcpOut = (data: DecoratedGraphNodeData): boolean => {
    return data.tcpOut > 0;
  };
}

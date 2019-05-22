import * as React from 'react';
import { renderDestServicesLinks, RenderLink, renderTitle } from './SummaryLink';
import { Icon } from 'patternfly-react';

import {
  getAccumulatedTrafficRateGrpc,
  getAccumulatedTrafficRateHttp,
  getTrafficRateGrpc,
  getTrafficRateHttp
} from '../../utils/TrafficRate';
import { InOutRateTableGrpc, InOutRateTableHttp } from '../../components/SummaryPanel/InOutRateTable';
import { RpsChart, TcpChart } from '../../components/SummaryPanel/RpsChart';
import { GraphType, NodeType, SummaryPanelPropType, Protocol } from '../../types/Graph';
import { Metrics, Metric } from '../../types/Metrics';
import {
  shouldRefreshData,
  updateHealth,
  nodeData,
  NodeData,
  NodeMetricType,
  getDatapoints,
  getNodeMetrics,
  getNodeMetricType,
  renderLabels,
  renderNoTraffic,
  mergeMetricsResponses
} from './SummaryPanelCommon';
import { HealthIndicator, DisplayMode } from '../../components/Health/HealthIndicator';
import { Health } from '../../types/Health';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import { Response } from '../../services/Api';
import { Reporter } from '../../types/MetricsOptions';
import { icons } from '../../config/Icons';
import { serverConfig } from '../../config/ServerConfig';
import { CyNode } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';

type SummaryPanelStateType = {
  loading: boolean;
  grpcRequestCountIn: [string | number][] | null;
  grpcRequestCountOut: [string | number][];
  grpcErrorCountIn: [string | number][];
  grpcErrorCountOut: [string | number][];
  httpRequestCountIn: [string | number][] | null;
  httpRequestCountOut: [string | number][];
  httpErrorCountIn: [string | number][];
  httpErrorCountOut: [string | number][];
  tcpSentIn: [string | number][];
  tcpSentOut: [string | number][];
  tcpReceivedIn: [string | number][];
  tcpReceivedOut: [string | number][];
  healthLoading: boolean;
  health?: Health;
  metricsLoadError: string | null;
};

export default class SummaryPanelNode extends React.Component<SummaryPanelPropType, SummaryPanelStateType> {
  static readonly panelStyle = {
    height: '100%',
    margin: 0,
    minWidth: '25em',
    overflowY: 'auto' as 'auto',
    width: '25em'
  };

  private metricsPromise?: CancelablePromise<Response<Metrics>[]>;
  private readonly mainDivRef: React.RefObject<HTMLDivElement>;

  constructor(props: SummaryPanelPropType) {
    super(props);
    this.showRequestCountMetrics = this.showRequestCountMetrics.bind(this);

    this.state = {
      loading: true,
      grpcRequestCountIn: null,
      grpcRequestCountOut: [],
      grpcErrorCountIn: [],
      grpcErrorCountOut: [],
      httpRequestCountIn: null,
      httpRequestCountOut: [],
      httpErrorCountIn: [],
      httpErrorCountOut: [],
      tcpSentIn: [],
      tcpSentOut: [],
      tcpReceivedIn: [],
      tcpReceivedOut: [],
      healthLoading: false,
      metricsLoadError: null
    };

    this.mainDivRef = React.createRef<HTMLDivElement>();
  }

  componentDidMount() {
    this.updateCharts(this.props);
    updateHealth(this.props.data.summaryTarget, this.setState.bind(this));
  }

  componentDidUpdate(prevProps: SummaryPanelPropType) {
    if (prevProps.data.summaryTarget !== this.props.data.summaryTarget) {
      this.setState({
        grpcRequestCountIn: null,
        loading: true
      });
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

  updateCharts(props: SummaryPanelPropType) {
    const target = props.data.summaryTarget;
    const data = nodeData(target);
    const nodeMetricType = getNodeMetricType(data);

    if (this.metricsPromise) {
      this.metricsPromise.cancel();
      this.metricsPromise = undefined;
    }

    if (!this.hasGrpcTraffic(target) && !this.hasHttpTraffic(target) && !this.hasTcpTraffic(target)) {
      this.setState({ loading: false });
      return;
    }

    // If destination node is inaccessible, we cannot query the data.
    if (data.isInaccessible) {
      this.setState({ loading: false });
      return;
    }

    let promiseOut: Promise<Response<Metrics>> = Promise.resolve({ data: { metrics: {}, histograms: {} } });
    let promiseIn: Promise<Response<Metrics>> = Promise.resolve({ data: { metrics: {}, histograms: {} } });

    // Ignore outgoing traffic if it is a non-root outsider (because they have no outgoing edges) or a
    // service node (because they don't have "real" outgoing edges).
    if (data.nodeType !== NodeType.SERVICE && (data.isRoot || !data.isOutsider)) {
      const filters = ['request_count', 'request_error_count', 'tcp_sent', 'tcp_received'];
      // use source metrics for outgoing, except for:
      // - unknown nodes (no source telemetry)
      // - istio namespace nodes (no source telemetry)
      const reporter: Reporter =
        data.nodeType === NodeType.UNKNOWN || data.namespace === serverConfig.istioNamespace ? 'destination' : 'source';
      // note: request_protocol is not a valid byLabel for tcp filters but it is ignored by prometheus
      const byLabels = data.isRoot ? ['destination_service_namespace', 'request_protocol'] : ['request_protocol'];
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
    if (!data.isRoot) {
      const filtersRps = ['request_count', 'request_error_count'];
      // use dest metrics for incoming, except for service nodes which need source metrics to capture source errors
      const reporter: Reporter =
        data.nodeType === NodeType.SERVICE && data.namespace !== serverConfig.istioNamespace ? 'source' : 'destination';
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
        this.showRequestCountMetrics(responses[0].data, responses[1].data, data, nodeMetricType);
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
          grpcRequestCountIn: null
        });
      });

    this.setState({ loading: true, metricsLoadError: null });
  }

  showRequestCountMetrics(outbound: Metrics, inbound: Metrics, data: NodeData, nodeMetricType: NodeMetricType) {
    let comparator = (metric: Metric, protocol?: Protocol) => {
      return protocol ? metric.request_protocol === protocol : true;
    };
    if (this.isServiceDestCornerCase(nodeMetricType)) {
      comparator = (metric: Metric, protocol?: Protocol) => {
        return (protocol ? metric.request_protocol === protocol : true) && metric.destination_workload === 'unknown';
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
      grpcRequestCountOut: getDatapoints(rcOut, 'RPS', comparator, Protocol.GRPC),
      grpcErrorCountOut: getDatapoints(ecOut, 'Error', comparator, Protocol.GRPC),
      grpcRequestCountIn: getDatapoints(rcIn, 'RPS', comparator, Protocol.GRPC),
      grpcErrorCountIn: getDatapoints(ecIn, 'Error', comparator, Protocol.GRPC),
      httpRequestCountOut: getDatapoints(rcOut, 'RPS', comparator, Protocol.HTTP),
      httpErrorCountOut: getDatapoints(ecOut, 'Error', comparator, Protocol.HTTP),
      httpRequestCountIn: getDatapoints(rcIn, 'RPS', comparator, Protocol.HTTP),
      httpErrorCountIn: getDatapoints(ecIn, 'Error', comparator, Protocol.HTTP),
      tcpSentOut: getDatapoints(tcpSentOut, 'Sent', comparator),
      tcpReceivedOut: getDatapoints(tcpReceivedOut, 'Received', comparator),
      tcpSentIn: getDatapoints(tcpSentIn, 'Sent', comparator),
      tcpReceivedIn: getDatapoints(tcpReceivedIn, 'Received', comparator)
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
    const data: NodeData = nodeData(node);
    const { nodeType, workload } = data;
    const servicesList = nodeType !== NodeType.SERVICE && renderDestServicesLinks(node);

    const shouldRenderSvcList = servicesList && servicesList.length > 0;
    const shouldRenderWorkload = nodeType !== NodeType.WORKLOAD && nodeType !== NodeType.UNKNOWN && workload;

    return (
      <div ref={this.mainDivRef} className="panel panel-default" style={SummaryPanelNode.panelStyle}>
        <div className="panel-heading">
          {this.state.healthLoading ? (
            // Remove glitch while health is being reloaded
            <span style={{ width: 18, height: 17, display: 'inline-block' }} />
          ) : (
            this.state.health && (
              <HealthIndicator
                id="graph-health-indicator"
                mode={DisplayMode.SMALL}
                health={this.state.health}
                tooltipPlacement="left"
              />
            )
          )}
          <span> {renderTitle(data)}</span>
          {renderLabels(data)}
          {this.renderBadgeSummary(
            node.data(CyNode.hasCB),
            node.data(CyNode.hasVS),
            node.data(CyNode.hasMissingSC),
            node.data(CyNode.isDead)
          )}
        </div>
        <div className="panel-body">
          {shouldRenderSvcList && (
            <div>
              <strong>Services: </strong>
              {servicesList}
            </div>
          )}
          {shouldRenderWorkload && (
            <div>
              <strong>Workload: </strong>
              <RenderLink data={data} nodeType={NodeType.WORKLOAD} />
            </div>
          )}
          {(shouldRenderSvcList || shouldRenderWorkload) && <hr />}
          {/* TODO: link to App or Workload Details charts when available
          {nodeType !== NodeType.UNKNOWN && (
            <p style={{ textAlign: 'right' }}>
              <Link to={`/namespaces/${namespace}/services/${app}?tab=metrics&groupings=local+version%2Cresponse+code`}>
                View detailed charts <Icon name="angle-double-right" />
              </Link>
            </p>
          )} */}
          {this.hasGrpcTraffic(node) && this.renderGrpcRates(node)}
          {this.hasHttpTraffic(node) && this.renderHttpRates(node)}
          <div>{this.renderCharts(node)}</div>
          {!this.hasGrpcTraffic(node) && renderNoTraffic('GRPC')}
          {!this.hasHttpTraffic(node) && renderNoTraffic('HTTP')}
        </div>
      </div>
    );
  }

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
        <hr />
      </>
    );
  };

  private renderHttpRates = node => {
    const incoming = getTrafficRateHttp(node);
    const outgoing = getAccumulatedTrafficRateHttp(this.props.data.summaryTarget.edgesTo('*'));

    return (
      <>
        <InOutRateTableHttp
          title="HTTP Traffic (requests per second):"
          inRate={incoming.rate}
          inRate3xx={incoming.rate3xx}
          inRate4xx={incoming.rate4xx}
          inRate5xx={incoming.rate5xx}
          outRate={outgoing.rate}
          outRate3xx={outgoing.rate3xx}
          outRate4xx={outgoing.rate4xx}
          outRate5xx={outgoing.rate5xx}
        />
        <hr />
      </>
    );
  };

  private renderCharts = node => {
    const data = nodeData(node);

    if (NodeType.UNKNOWN === data.nodeType) {
      return (
        <>
          <div>
            <Icon type="pf" name="info" /> Sparkline charts not supported for unknown node. Use edge for details.
            <hr />
          </div>
        </>
      );
    } else if (data.isInaccessible) {
      return (
        <>
          <div>
            <Icon type="pf" name="info" /> Sparkline charts cannot be shown because the selected node is inaccessible.
            <hr />
          </div>
        </>
      );
    }
    if (this.state.loading && !this.state.grpcRequestCountIn) {
      return <strong>Loading charts...</strong>;
    }
    if (this.state.metricsLoadError) {
      return (
        <div>
          <Icon type="pf" name="warning-triangle-o" /> <strong>Error loading metrics: </strong>
          {this.state.metricsLoadError}
        </div>
      );
    }

    const isServiceNode = node.data(CyNode.nodeType) === NodeType.SERVICE;
    let serviceWithUnknownSource: boolean = false;
    if (isServiceNode) {
      for (const n of node.incomers()) {
        if (NodeType.UNKNOWN === n.data(CyNode.nodeType)) {
          serviceWithUnknownSource = true;
          break;
        }
      }
    }

    let grpcCharts, httpCharts, tcpCharts;

    if (this.hasGrpcTraffic(node)) {
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
                <Icon type="pf" name="info" /> Traffic from unknown not included. Use edge for details.
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
                <Icon type="pf" name="info" /> Traffic to istio-system not included. Use edge for details.
              </div>
            </>
          )}
          <hr />
        </>
      );
    }

    if (this.hasHttpTraffic(node)) {
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
                <Icon type="pf" name="info" /> Traffic from unknown not included. Use edge for details.
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
                <Icon type="pf" name="info" /> Traffic to istio-system not included. Use edge for details.
              </div>
            </>
          )}
          <hr />
        </>
      );
    }

    if (this.hasTcpTraffic(node)) {
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
          <hr />
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
  private renderBadgeSummary = (hasCB: boolean, hasVS: boolean, hasMissingSC: boolean, isDead: boolean) => {
    return (
      <>
        {hasCB && (
          <div>
            <Icon
              name={icons.istio.circuitBreaker.name}
              type={icons.istio.circuitBreaker.type}
              style={{ width: '10px' }}
            />
            <span style={{ paddingLeft: '4px' }}>Has Circuit Breaker</span>
          </div>
        )}
        {hasVS && (
          <div>
            <Icon
              name={icons.istio.virtualService.name}
              type={icons.istio.virtualService.type}
              style={{ width: '10px' }}
            />
            <span style={{ paddingLeft: '4px' }}>Has Virtual Service</span>
          </div>
        )}
        {hasMissingSC && (
          <div>
            <Icon
              name={icons.istio.missingSidecar.name}
              type={icons.istio.missingSidecar.type}
              style={{ width: '10px', marginRight: '5px' }}
            />
            <span style={{ paddingLeft: '4px' }}>Has Missing Sidecar</span>
          </div>
        )}
        {isDead && (
          <div>
            <Icon type="pf" name="info" style={{ width: '10px', marginRight: '5px' }} />
            <span style={{ paddingLeft: '4px' }}>Has No Running Pods</span>
          </div>
        )}
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

  // We need to handle the special case of a non-istio-system, non-unknown node with outgoing traffic to istio-system.
  // The traffic is lost because it is dest-only and we use source-reporting.
  private isIstioOutgoingCornerCase = (node): boolean => {
    const nodeType = node.data(CyNode.nodeType);
    const namespace = node.data(CyNode.namespace);
    const istioNamespace = serverConfig.istioNamespace;
    if (nodeType === NodeType.UNKNOWN || namespace === istioNamespace) {
      return false;
    }
    return node.edgesTo(`node[${CyNode.namespace} = "${istioNamespace}"]`).size() > 0;
  };

  private hasGrpcTraffic = (node): boolean => {
    return node.data(CyNode.grpcIn) > 0 || node.data(CyNode.grpcOut) > 0;
  };

  private hasHttpTraffic = (node): boolean => {
    return node.data(CyNode.httpIn) > 0 || node.data(CyNode.httpOut) > 0;
  };

  private hasTcpTraffic = (node): boolean => {
    return node.data(CyNode.tcpIn) > 0 || node.data(CyNode.tcpOut) > 0;
  };
}

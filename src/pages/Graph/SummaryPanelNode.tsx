import * as React from 'react';
import { renderDestServicesLinks, RenderLink, renderTitle } from './SummaryLink';
import { Icon } from 'patternfly-react';

import { getTrafficRate, getAccumulatedTrafficRate } from '../../utils/TrafficRate';
import InOutRateTable from '../../components/SummaryPanel/InOutRateTable';
import { RpsChart, TcpChart } from '../../components/SummaryPanel/RpsChart';
import { GraphType, NodeType, SummaryPanelPropType } from '../../types/Graph';
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
import { serverConfig, ICONS } from '../../config';
import { Reporter } from 'src/types/MetricsOptions';

type SummaryPanelStateType = {
  loading: boolean;
  requestCountIn: [string, number][] | null;
  requestCountOut: [string, number][];
  errorCountIn: [string, number][];
  errorCountOut: [string, number][];
  tcpSentIn: [string, number][];
  tcpSentOut: [string, number][];
  tcpReceivedIn: [string, number][];
  tcpReceivedOut: [string, number][];
  healthLoading: boolean;
  health?: Health;
  metricsLoadError: string | null;
};

export default class SummaryPanelNode extends React.Component<SummaryPanelPropType, SummaryPanelStateType> {
  static readonly panelStyle = {
    width: '25em',
    minWidth: '25em',
    overflowY: 'auto' as 'auto'
  };

  private metricsPromise?: CancelablePromise<Response<Metrics>[]>;

  constructor(props: SummaryPanelPropType) {
    super(props);
    this.showRequestCountMetrics = this.showRequestCountMetrics.bind(this);

    this.state = {
      loading: true,
      requestCountIn: null,
      requestCountOut: [],
      errorCountIn: [],
      errorCountOut: [],
      tcpSentIn: [],
      tcpSentOut: [],
      tcpReceivedIn: [],
      tcpReceivedOut: [],
      healthLoading: false,
      metricsLoadError: null
    };
  }

  componentDidMount() {
    this.fetchRequestCountMetrics(this.props);
    updateHealth(this.props.data.summaryTarget, this.setState.bind(this));
  }

  componentDidUpdate(prevProps: SummaryPanelPropType) {
    if (prevProps.data.summaryTarget !== this.props.data.summaryTarget) {
      this.setState({
        requestCountIn: null,
        loading: true
      });
    }
    if (shouldRefreshData(prevProps, this.props)) {
      this.fetchRequestCountMetrics(this.props);
      updateHealth(this.props.data.summaryTarget, this.setState.bind(this));
    }
  }

  componentWillUnmount() {
    if (this.metricsPromise) {
      this.metricsPromise.cancel();
    }
  }

  fetchRequestCountMetrics(props: SummaryPanelPropType) {
    const target = props.data.summaryTarget;
    const data = nodeData(target);
    const nodeMetricType = getNodeMetricType(data);

    if (this.metricsPromise) {
      this.metricsPromise.cancel();
      this.metricsPromise = undefined;
    }

    if (!nodeMetricType || (!this.hasHttpTraffic(target) && !this.hasTcpTraffic(target))) {
      this.setState({ loading: false });
      return;
    }

    let promiseOut: Promise<Response<Metrics>>, promiseIn: Promise<Response<Metrics>>;
    // set outgoing unless it is a non-root outsider (because they have no outgoing edges) or a
    // service node (because they don't have "real" outgoing edges).
    if (data.nodeType !== NodeType.SERVICE && (data.isRoot || !data.isOutsider)) {
      const filters = ['request_count', 'request_error_count', 'tcp_sent', 'tcp_received'];
      // use source metrics for outgoing, except for:
      // - unknown nodes (no source telemetry)
      // - istio namespace nodes (no source telemetry)
      const reporter: Reporter =
        data.nodeType === NodeType.UNKNOWN || data.namespace === serverConfig().istioNamespace
          ? 'destination'
          : 'source';
      const byLabels = data.isRoot ? ['destination_service_namespace'] : undefined;
      promiseOut = getNodeMetrics(nodeMetricType, target, props, filters, 'outbound', reporter, undefined, byLabels);
    } else {
      promiseOut = Promise.resolve({ data: { metrics: {}, histograms: {} } });
    }
    // set incoming unless it is a root (because they have no incoming edges)
    if (!data.isRoot) {
      const filtersHTTP = ['request_count', 'request_error_count'];
      // use dest metrics for incoming, except for service nodes which need source metrics to capture source errors
      const reporter: Reporter =
        data.nodeType === NodeType.SERVICE && data.namespace !== serverConfig().istioNamespace
          ? 'destination'
          : 'source';
      // For special service dest nodes we want to narrow the data to only TS with 'unknown' workloads (see the related
      // comparator in getNodeDatapoints).
      const byLabels = this.isSpecialServiceDest(nodeMetricType) ? ['destination_workload'] : undefined;
      const promiseHTTP = getNodeMetrics(
        nodeMetricType,
        target,
        props,
        filtersHTTP,
        'inbound',
        reporter,
        undefined,
        byLabels
      );
      const filtersTCP = ['tcp_sent', 'tcp_received'];
      const promiseTCP = getNodeMetrics(
        nodeMetricType,
        target,
        props,
        filtersTCP,
        'inbound',
        'source',
        undefined,
        byLabels
      );
      promiseIn = mergeMetricsResponses([promiseHTTP, promiseTCP]);
    } else {
      promiseIn = Promise.resolve({ data: { metrics: {}, histograms: {} } });
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
          requestCountIn: null
        });
      });

    this.setState({ loading: true, metricsLoadError: null });
  }

  showRequestCountMetrics(outbound: Metrics, inbound: Metrics, data: NodeData, nodeMetricType: NodeMetricType) {
    let comparator;
    if (this.isSpecialServiceDest(nodeMetricType)) {
      comparator = (metric: Metric) => {
        return metric['destination_workload'] === 'unknown';
      };
    } else if (data.isRoot) {
      comparator = (metric: Metric) => {
        return this.isActiveNamespace(metric['destination_service_namespace']);
      };
    }
    const rcOut = outbound.metrics['request_count'];
    const ecOut = outbound.metrics['request_error_count'];
    const tcpSentOut = outbound.metrics['tcp_sent'];
    const tcpReceivedOut = outbound.metrics['tcp_received'];
    const rcIn = inbound.metrics['request_count'];
    const ecIn = inbound.metrics['request_error_count'];
    const tcpSentIn = inbound.metrics['tcp_sent'];
    const tcpReceivedIn = inbound.metrics['tcp_received'];
    this.setState({
      loading: false,
      requestCountOut: getDatapoints(rcOut, 'RPS', comparator),
      errorCountOut: getDatapoints(ecOut, 'Error', comparator),
      requestCountIn: getDatapoints(rcIn, 'RPS', comparator),
      errorCountIn: getDatapoints(ecIn, 'Error', comparator),
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
      <div className="panel panel-default" style={SummaryPanelNode.panelStyle}>
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
            node.data('hasCB'),
            node.data('isServiceEntry'),
            node.data('hasVS'),
            node.data('hasMissingSC')
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
          {this.hasHttpTraffic(node) ? this.renderHttpRates(node) : renderNoTraffic('HTTP')}
          <div>{this.renderSparklines(node)}</div>
        </div>
      </div>
    );
  }

  private renderHttpRates = node => {
    const incoming = getTrafficRate(node);
    const outgoing = getAccumulatedTrafficRate(this.props.data.summaryTarget.edgesTo('*'));

    return (
      <>
        <InOutRateTable
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

  private renderSparklines = node => {
    if (this.state.loading && !this.state.requestCountIn) {
      return <strong>Loading charts...</strong>;
    } else if (this.state.metricsLoadError) {
      return (
        <div>
          <Icon type="pf" name="warning-triangle-o" /> <strong>Error loading metrics: </strong>
          {this.state.metricsLoadError}
        </div>
      );
    }

    const isServiceNode = node.data('nodeType') === NodeType.SERVICE;
    let serviceWithUnknownSource: boolean = false;
    if (isServiceNode) {
      for (const n of node.incomers()) {
        if (NodeType.UNKNOWN === n.data('nodeType')) {
          serviceWithUnknownSource = true;
          break;
        }
      }
    }
    let httpCharts, tcpCharts;

    if (this.hasHttpTraffic(node)) {
      httpCharts = (
        <>
          <RpsChart
            label={isServiceNode ? 'HTTP - Request Traffic' : 'HTTP - Inbound Request Traffic'}
            dataRps={this.state.requestCountIn!}
            dataErrors={this.state.errorCountIn}
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
            dataRps={this.state.requestCountOut}
            dataErrors={this.state.errorCountOut}
            hide={isServiceNode}
          />
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
        {httpCharts}
        {tcpCharts}
      </>
    );
  };

  // TODO:(see https://github.com/kiali/kiali-design/issues/63) If we want to show an icon for SE uncomment below
  private renderBadgeSummary = (hasCB: boolean, isServiceEntry: string, hasVS: boolean, hasMissingSC: boolean) => {
    return (
      <>
        {hasCB && (
          <div>
            <Icon
              name={ICONS().ISTIO.CIRCUIT_BREAKER.name}
              type={ICONS().ISTIO.CIRCUIT_BREAKER.type}
              style={{ width: '10px' }}
            />
            <span style={{ paddingLeft: '4px' }}>Has Circuit Breaker</span>
          </div>
        )}
        {
          // isServiceEntry !== undefined && (
          // <div>
          // <Icon
          //   name={ICONS().ISTIO.SERVICEENTRY.name}
          //   type={ICONS().ISTIO.SERVICEENTRY.type}
          //   style={{ width: '10px' }}
          // />
          //  <span style={{ paddingLeft: '4px' }}>Is Service Entry ({isServiceEntry})</span>
          // </div>
          // )
        }
        {hasVS && (
          <div>
            <Icon
              name={ICONS().ISTIO.VIRTUALSERVICE.name}
              type={ICONS().ISTIO.VIRTUALSERVICE.type}
              style={{ width: '10px' }}
            />
            <span style={{ paddingLeft: '4px' }}>Has Virtual Service</span>
          </div>
        )}
        {hasMissingSC && (
          <div>
            <Icon
              name={ICONS().ISTIO.MISSING_SIDECAR.name}
              type={ICONS().ISTIO.MISSING_SIDECAR.type}
              style={{ width: '10px', marginRight: '5px' }}
            />
            <span style={{ paddingLeft: '4px' }}>Has Missing Sidecar</span>
          </div>
        )}
      </>
    );
  };

  // We need to handle the special case of a dest service node showing client failures. These service nodes show up in
  // non-service graphs, even when not injecting service nodes.
  private isSpecialServiceDest(nodeMetricType: NodeMetricType) {
    return (
      nodeMetricType === NodeMetricType.SERVICE &&
      !this.props.injectServiceNodes &&
      this.props.graphType !== GraphType.SERVICE
    );
  }

  private hasHttpTraffic = (node): boolean => {
    if (node.data('rate') || node.data('rateOut')) {
      return true;
    }
    return false;
  };

  private hasTcpTraffic = (node): boolean => {
    if (node.data('rateTcpSent') || node.data('rateTcpSentOut')) {
      return true;
    }
    return false;
  };
}

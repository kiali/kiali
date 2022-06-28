import * as React from 'react';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { InOutRateTableGrpc, InOutRateTableHttp } from '../../components/SummaryPanel/InOutRateTable';
import { RequestChart, StreamChart } from '../../components/SummaryPanel/RpsChart';
import { NodeType, Protocol, SummaryPanelPropType, TrafficRate } from '../../types/Graph';
import { getAccumulatedTrafficRateGrpc, getAccumulatedTrafficRateHttp } from '../../utils/TrafficRate';
import { renderBadgedLink, renderHealth } from './SummaryLink';
import {
  shouldRefreshData,
  getNodeMetrics,
  getNodeMetricType,
  renderNoTraffic,
  summaryHeader,
  hr,
  summaryPanel,
  mergeMetricsResponses,
  getDatapoints,
  getTitle
} from './SummaryPanelCommon';
import { Response } from '../../services/Api';
import { IstioMetricsMap, Datapoint, Labels } from '../../types/Metrics';
import { Reporter } from '../../types/MetricsOptions';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import { KialiIcon } from 'config/KialiIcon';
import { decoratedNodeData, CyNode } from 'components/CytoscapeGraph/CytoscapeGraphUtils';
import { Dropdown, DropdownPosition, DropdownItem, KebabToggle, DropdownGroup } from '@patternfly/react-core';
import { getOptions, clickHandler } from 'components/CytoscapeGraph/ContextMenu/NodeContextMenu';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';

type SummaryPanelAppBoxMetricsState = {
  grpcRequestIn: Datapoint[];
  grpcRequestOut: Datapoint[];
  grpcRequestErrIn: Datapoint[];
  grpcRequestErrOut: Datapoint[];
  grpcSentIn: Datapoint[];
  grpcSentOut: Datapoint[];
  grpcReceivedIn: Datapoint[];
  grpcReceivedOut: Datapoint[];
  httpRequestIn: Datapoint[];
  httpRequestOut: Datapoint[];
  httpRequestErrIn: Datapoint[];
  httpRequestErrOut: Datapoint[];
  tcpSentIn: Datapoint[];
  tcpSentOut: Datapoint[];
  tcpReceivedIn: Datapoint[];
  tcpReceivedOut: Datapoint[];
};

type SummaryPanelAppBoxState = SummaryPanelAppBoxMetricsState & {
  appBox: any;
  isOpen: boolean;
  loading: boolean;
  metricsLoadError: string | null;
};

const defaultMetricsState: SummaryPanelAppBoxMetricsState = {
  grpcRequestIn: [],
  grpcRequestOut: [],
  grpcRequestErrIn: [],
  grpcRequestErrOut: [],
  grpcSentIn: [],
  grpcSentOut: [],
  grpcReceivedIn: [],
  grpcReceivedOut: [],
  httpRequestIn: [],
  httpRequestOut: [],
  httpRequestErrIn: [],
  httpRequestErrOut: [],
  tcpSentIn: [],
  tcpSentOut: [],
  tcpReceivedIn: [],
  tcpReceivedOut: []
};

const defaultState: SummaryPanelAppBoxState = {
  appBox: null,
  isOpen: false,
  loading: false,
  metricsLoadError: null,
  ...defaultMetricsState
};

export default class SummaryPanelAppBox extends React.Component<SummaryPanelPropType, SummaryPanelAppBoxState> {
  private metricsPromise?: CancelablePromise<Response<IstioMetricsMap>[]>;
  private readonly mainDivRef: React.RefObject<HTMLDivElement>;

  constructor(props: SummaryPanelPropType) {
    super(props);
    this.state = { ...defaultState };

    this.mainDivRef = React.createRef<HTMLDivElement>();
  }

  static getDerivedStateFromProps(props: SummaryPanelPropType, state: SummaryPanelAppBoxState) {
    // if the summaryTarget (i.e. selected appBox) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.data.summaryTarget !== state.appBox
      ? { appBox: props.data.summaryTarget, loading: true, ...defaultMetricsState }
      : null;
  }

  componentDidMount() {
    this.updateCharts(this.props);
  }

  componentDidUpdate(prevProps: SummaryPanelPropType) {
    if (prevProps.data.summaryTarget !== this.props.data.summaryTarget) {
      if (this.mainDivRef.current) {
        this.mainDivRef.current.scrollTop = 0;
      }
    }
    if (shouldRefreshData(prevProps, this.props)) {
      this.updateCharts(this.props);
    }
  }

  componentWillUnmount() {
    if (this.metricsPromise) {
      this.metricsPromise.cancel();
    }
  }

  render() {
    const appBox = this.props.data.summaryTarget;
    const nodeData = decoratedNodeData(appBox);

    const serviceList = this.renderServiceList(appBox);
    const workloadList = this.renderWorkloadList(appBox);
    const hasGrpc = this.hasGrpcTraffic(appBox);
    const isGrpcRequests = hasGrpc && this.isGrpcRequests();
    const hasGrpcIn = hasGrpc && this.hasGrpcIn(appBox);
    const hasGrpcOut = hasGrpc && this.hasGrpcOut(appBox);
    const hasHttp = this.hasHttpTraffic(appBox);
    const hasHttpIn = hasHttp && this.hasHttpIn(appBox);
    const hasHttpOut = hasHttp && this.hasHttpOut(appBox);
    const hasTcp = this.hasTcpTraffic(appBox);
    const hasTcpIn = hasTcp && this.hasTcpIn(appBox);
    const hasTcpOut = hasTcp && this.hasTcpOut(appBox);

    const options = getOptions(nodeData).map(o => {
      return (
        <DropdownItem key={o.text} onClick={() => clickHandler(o)}>
          {o.text} {o.target === '_blank' && <ExternalLinkAltIcon />}
        </DropdownItem>
      );
    });
    const actions =
      options.length > 0
        ? [<DropdownGroup label="Show" className="kiali-appbox-menu" children={options} />]
        : undefined;

    return (
      <div ref={this.mainDivRef} className={`panel panel-default ${summaryPanel}`}>
        <div className="panel-heading" style={summaryHeader}>
          {getTitle('Application')}
          <span>
            <PFBadge badge={PFBadges.Namespace} size="sm" style={{ marginBottom: '2px' }} />
            {nodeData.namespace}
            {actions && (
              <Dropdown
                id="summary-appbox-actions"
                isPlain={true}
                style={{ float: 'right' }}
                dropdownItems={actions}
                isOpen={this.state.isOpen}
                position={DropdownPosition.right}
                toggle={<KebabToggle id="summary-appbox-kebab" onToggle={this.onToggleActions} />}
                isGrouped={true}
              />
            )}
            {renderBadgedLink(nodeData)}
            {renderHealth(nodeData.health)}
          </span>
          <div>
            {this.renderBadgeSummary(appBox)}
            {serviceList.length > 0 && <div>{serviceList}</div>}
            {workloadList.length > 0 && <div> {workloadList}</div>}
          </div>
        </div>
        <div className="panel-body">
          {hasGrpc && isGrpcRequests && (
            <>
              {this.renderGrpcRequests(appBox)}
              {hr()}
            </>
          )}
          {hasHttp && (
            <>
              {this.renderHttpRequests(appBox)}
              {hr()}
            </>
          )}
          <div>
            {this.renderSparklines(appBox)}
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
        </div>
      </div>
    );
  }

  private onToggleActions = isExpanded => {
    this.setState({ isOpen: isExpanded });
  };

  private updateCharts = (props: SummaryPanelPropType) => {
    const appBox = props.data.summaryTarget;
    const nodeData = decoratedNodeData(appBox);
    const nodeMetricType = getNodeMetricType(nodeData);
    const isGrpcRequests = this.isGrpcRequests();

    if (this.metricsPromise) {
      this.metricsPromise.cancel();
      this.metricsPromise = undefined;
    }

    if (!this.hasGrpcTraffic(appBox) && !this.hasHttpTraffic(appBox) && !this.hasTcpTraffic(appBox)) {
      this.setState({ loading: false });
      return;
    }

    // appBoxes are never root nodes, so always look for inbound traffic
    let promiseInRps: Promise<Response<IstioMetricsMap>> = Promise.resolve({ data: {} });
    let promiseInStream: Promise<Response<IstioMetricsMap>> = Promise.resolve({ data: {} });

    if (this.hasHttpIn(appBox) || (this.hasGrpcIn(appBox) && isGrpcRequests)) {
      const filtersRps = ['request_count', 'request_error_count'];

      promiseInRps = getNodeMetrics(
        nodeMetricType,
        appBox,
        props,
        filtersRps,
        'inbound',
        'destination',
        undefined,
        undefined,
        ['request_protocol']
      );
    }

    if (this.hasTcpIn(appBox) || (this.hasGrpcIn(appBox) && !isGrpcRequests)) {
      const filtersStream = [] as string[];

      if (this.hasGrpcIn(appBox) && !isGrpcRequests) {
        filtersStream.push('grpc_sent', 'grpc_received');
      }
      if (this.hasTcpIn(appBox)) {
        filtersStream.push('tcp_sent', 'tcp_received');
      }
      if (filtersStream.length > 0) {
        const byLabelsStream = nodeData.isOutside ? ['source_workload_namespace'] : [];

        promiseInStream = getNodeMetrics(
          nodeMetricType,
          appBox,
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

    const promiseIn = mergeMetricsResponses([promiseInRps, promiseInStream]);
    let promiseOut: Promise<Response<IstioMetricsMap>> = Promise.resolve({ data: {} });

    // Ignore outbound traffic if it is a non-root (appbox is always non-root) outsider (because they have no outbound edges)
    if (!nodeData.isOutside) {
      const filters = [] as string[];
      if (this.hasHttpOut(appBox) || (this.hasGrpcOut(appBox) && isGrpcRequests)) {
        filters.push('request_count', 'request_error_count');
      }
      if (this.hasGrpcOut(appBox) && !isGrpcRequests) {
        filters.push('grpc_sent', 'grpc_received');
      }
      if (this.hasTcpOut(appBox)) {
        filters.push('tcp_sent', 'tcp_received');
      }

      if (filters.length > 0) {
        // use source metrics for outbound, except for:
        // - istio namespace nodes (no source telemetry)
        const reporter: Reporter = nodeData.isIstio ? 'destination' : 'source';
        // note: request_protocol is not a valid byLabel for tcp/grpc-message filters but it is ignored by prometheus
        const byLabels = nodeData.isOutside
          ? ['destination_service_namespace', 'request_protocol']
          : ['request_protocol'];
        promiseOut = getNodeMetrics(
          nodeMetricType,
          appBox,
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

    // use dest metrics for inbound
    this.metricsPromise = makeCancelablePromise(Promise.all([promiseOut, promiseIn]));

    this.metricsPromise.promise
      .then((responses: Response<IstioMetricsMap>[]) => {
        const comparator = nodeData.isOutside
          ? (labels: Labels, protocol?: Protocol) => {
              return protocol ? labels.request_protocol === protocol : true;
            }
          : (labels: Labels, protocol?: Protocol) => {
              if (protocol && labels.request_protocol !== protocol) {
                return false;
              }
              if (
                labels.destination_service_namespace &&
                !this.isActiveNamespace(labels.destination_service_namespace)
              ) {
                return false;
              }
              if (labels.source_workload_namespace && !this.isActiveNamespace(labels.source_workload_namespace)) {
                return false;
              }
              return true;
            };

        const metricsOut = responses[0].data;
        const metricsIn = responses[1].data;
        this.setState({
          loading: false,
          grpcRequestErrIn: getDatapoints(metricsIn.request_error_count, comparator, Protocol.GRPC),
          grpcRequestErrOut: getDatapoints(metricsOut.request_error_count, comparator, Protocol.GRPC),
          grpcReceivedIn: getDatapoints(metricsIn.grpc_received, comparator),
          grpcReceivedOut: getDatapoints(metricsOut.grpc_received, comparator),
          grpcRequestIn: getDatapoints(metricsIn.request_count, comparator, Protocol.GRPC),
          grpcRequestOut: getDatapoints(metricsOut.request_count, comparator, Protocol.GRPC),
          grpcSentIn: getDatapoints(metricsIn.grpc_sent, comparator),
          grpcSentOut: getDatapoints(metricsOut.grpc_sent, comparator),
          httpRequestErrIn: getDatapoints(metricsIn.request_error_count, comparator, Protocol.HTTP),
          httpRequestErrOut: getDatapoints(metricsOut.request_error_count, comparator, Protocol.HTTP),
          httpRequestIn: getDatapoints(metricsIn.request_count, comparator, Protocol.HTTP),
          httpRequestOut: getDatapoints(metricsOut.request_count, comparator, Protocol.HTTP),
          tcpReceivedOut: getDatapoints(metricsOut.tcp_received, comparator),
          tcpReceivedIn: getDatapoints(metricsIn.tcp_received, comparator),
          tcpSentIn: getDatapoints(metricsIn.tcp_sent, comparator),
          tcpSentOut: getDatapoints(metricsOut.tcp_sent, comparator)
        });
      })
      .catch(error => {
        if (error.isCanceled) {
          console.debug('SummaryPanelAppBox: Ignore fetch error (canceled).');
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
  };

  private isActiveNamespace = (namespace: string): boolean => {
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

  private renderBadgeSummary = appBox => {
    let hasCB: boolean = appBox.data(CyNode.hasCB) === true;
    let hasVS: boolean = appBox.data(CyNode.hasVS) === true;

    appBox
      .children(`node[${CyNode.hasCB}],[${CyNode.hasVS}]`)
      .nodes()
      .forEach(n => {
        hasCB = hasCB || n.data(CyNode.hasCB);
        hasVS = hasVS || n.data(CyNode.hasVS);
      });

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
      </div>
    );
  };

  private renderGrpcRequests = appBox => {
    // only consider the physical children to avoid inflated rates
    const validChildren = appBox.children(
      `node[nodeType != "${NodeType.SERVICE}"][nodeType != "${NodeType.AGGREGATE}"]`
    );
    const inbound = getAccumulatedTrafficRateGrpc(validChildren.incomers('edge'));
    const outbound = getAccumulatedTrafficRateGrpc(validChildren.edgesTo('*'));

    return (
      <>
        <InOutRateTableGrpc
          title="GRPC Traffic (requests per second):"
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

  private renderHttpRequests = appBox => {
    // only consider the physical children to avoid inflated rates
    const validChildren = appBox.children(
      `node[nodeType != "${NodeType.SERVICE}"][nodeType != "${NodeType.AGGREGATE}"]`
    );
    const inbound = getAccumulatedTrafficRateHttp(validChildren.incomers('edge'));
    const outbound = getAccumulatedTrafficRateHttp(validChildren.edgesTo('*'));

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

  private renderSparklines = appBox => {
    if (this.state.loading) {
      return <strong>Loading charts...</strong>;
    } else if (this.state.metricsLoadError) {
      return (
        <div>
          <KialiIcon.Warning /> <strong>Error loading metrics: </strong>
          {this.state.metricsLoadError}
        </div>
      );
    }

    const hasGrpc = this.hasGrpcTraffic(appBox);
    const isGrpcRequests = hasGrpc && this.isGrpcRequests();
    const hasGrpcIn = hasGrpc && this.hasGrpcIn(appBox);
    const hasGrpcOut = hasGrpc && this.hasGrpcOut(appBox);
    const hasHttp = this.hasHttpTraffic(appBox);
    const hasHttpIn = hasHttp && this.hasHttpIn(appBox);
    const hasHttpOut = hasHttp && this.hasHttpOut(appBox);
    const hasTcp = this.hasTcpTraffic(appBox);
    const hasTcpIn = hasTcp && this.hasTcpIn(appBox);
    const hasTcpOut = hasTcp && this.hasTcpOut(appBox);
    let grpcCharts, httpCharts, tcpCharts;

    if (hasGrpc) {
      grpcCharts = isGrpcRequests ? (
        <>
          {hasGrpcIn && (
            <RequestChart
              key="grpc-inbound-request"
              label="gRPC - Inbound Request Traffic"
              dataRps={this.state.grpcRequestIn!}
              dataErrors={this.state.grpcRequestErrIn}
            />
          )}
          {hasGrpcOut && (
            <RequestChart
              key="grpc-outbound-request"
              label="gRPC - Outbound Request Traffic"
              dataRps={this.state.grpcRequestOut}
              dataErrors={this.state.grpcRequestErrOut}
            />
          )}
        </>
      ) : (
        <>
          {hasGrpcIn && (
            <StreamChart
              label="gRPC - Inbound Traffic"
              receivedRates={this.state.grpcReceivedIn}
              sentRates={this.state.grpcSentIn}
              unit="messages"
            />
          )}
          {hasGrpcOut && (
            <StreamChart
              label="gRPC - Outbound Traffic"
              receivedRates={this.state.grpcReceivedOut}
              sentRates={this.state.grpcSentOut}
              unit="messages"
            />
          )}
        </>
      );
    }

    if (hasHttp) {
      httpCharts = (
        <>
          {hasHttpIn && (
            <RequestChart
              key="http-inbound-request"
              label="HTTP - Inbound Request Traffic"
              dataRps={this.state.httpRequestIn}
              dataErrors={this.state.httpRequestErrIn}
            />
          )}
          {hasHttpOut && (
            <RequestChart
              key="http-outbound-request"
              label="HTTP - Outbound Request Traffic"
              dataRps={this.state.httpRequestOut}
              dataErrors={this.state.httpRequestErrOut}
            />
          )}
        </>
      );
    }

    if (hasTcp) {
      tcpCharts = (
        <>
          {hasTcpIn && (
            <StreamChart
              key="tcp-inbound-request"
              label="TCP - Inbound Traffic"
              receivedRates={this.state.tcpReceivedIn}
              sentRates={this.state.tcpSentIn}
              unit="bytes"
            />
          )}
          {hasTcpOut && (
            <StreamChart
              key="tcp-outbound-request"
              label="TCP - Outbound Traffic"
              receivedRates={this.state.tcpReceivedOut}
              sentRates={this.state.tcpSentOut}
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

  private renderServiceList = (appBox): any[] => {
    // likely 0 or 1 but support N in case of unanticipated labeling
    const serviceList: any[] = [];

    appBox.children(`node[nodeType = "${NodeType.SERVICE}"]`).forEach(serviceNode => {
      const serviceNodeData = decoratedNodeData(serviceNode);
      serviceList.push(renderBadgedLink(serviceNodeData, NodeType.SERVICE));
      const aggregates = appBox.children(
        `node[nodeType = "${NodeType.AGGREGATE}"][service = "${serviceNodeData.service}"]`
      );
      if (!!aggregates && aggregates.length > 0) {
        const aggregateList: any[] = [];
        aggregates.forEach(aggregateNode => {
          const aggregateNodeData = decoratedNodeData(aggregateNode);
          aggregateList.push(renderBadgedLink(aggregateNodeData, NodeType.AGGREGATE));
        });
        serviceList.push(<div>{aggregateList}</div>);
      }
    });

    return serviceList;
  };

  private renderWorkloadList = (appBox): any[] => {
    const workloadList: any[] = [];

    appBox.children('node[workload]').forEach(node => {
      const nodeData = decoratedNodeData(node);
      workloadList.push(renderBadgedLink(nodeData, NodeType.WORKLOAD));
    });

    return workloadList;
  };

  private isGrpcRequests = (): boolean => {
    return this.props.trafficRates.includes(TrafficRate.GRPC_REQUEST);
  };

  private hasGrpcTraffic = (appBox): boolean => {
    return appBox.children().filter('[nodeType != "service"]').filter('[grpcIn > 0],[grpcOut > 0]').size() > 0;
  };

  private hasGrpcIn = (appBox): boolean => {
    return appBox.children().filter('[nodeType != "service"]').filter('[grpcIn > 0]').size() > 0;
  };

  private hasGrpcOut = (appBox): boolean => {
    return appBox.children().filter('[nodeType != "service"]').filter('[grpcOut > 0]').size() > 0;
  };

  private hasHttpTraffic = (appBox): boolean => {
    return appBox.children().filter('[nodeType != "service"]').filter('[httpIn > 0],[httpOut > 0]').size() > 0;
  };

  private hasHttpIn = (appBox): boolean => {
    return appBox.children().filter('[nodeType != "service"]').filter('[httpIn > 0]').size() > 0;
  };

  private hasHttpOut = (appBox): boolean => {
    return appBox.children().filter('[nodeType != "service"]').filter('[httpOut > 0]').size() > 0;
  };

  private hasTcpTraffic = (appBox): boolean => {
    return appBox.children().filter('[nodeType != "service"]').filter('[tcpIn > 0],[tcpOut > 0]').size() > 0;
  };
  private hasTcpIn = (appBox): boolean => {
    return appBox.children().filter('[nodeType != "service"]').filter('[tcpIn > 0]').size() > 0;
  };
  private hasTcpOut = (appBox): boolean => {
    return appBox.children().filter('[nodeType != "service"]').filter('[tcpOut > 0]').size() > 0;
  };
}

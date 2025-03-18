import * as React from 'react';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { Node } from '@patternfly/react-topology';
import { InOutRateTableGrpc, InOutRateTableHttp } from '../../components/SummaryPanel/InOutRateTable';
import { RequestChart, StreamChart } from '../../components/SummaryPanel/RpsChart';
import {
  DecoratedGraphNodeData,
  NodeAttr,
  NodeType,
  Protocol,
  SummaryPanelPropType,
  TrafficRate
} from '../../types/Graph';
import { getAccumulatedTrafficRateGrpc, getAccumulatedTrafficRateHttp } from '../../utils/TrafficRate';
import { renderBadgedLink, renderHealth } from './SummaryLink';
import {
  shouldRefreshData,
  getNodeMetrics,
  getNodeMetricType,
  renderNoTraffic,
  hr,
  summaryPanel,
  mergeMetricsResponses,
  getDatapoints,
  getTitle
} from './SummaryPanelCommon';
import { IstioMetricsMap, Datapoint, Labels } from '../../types/Metrics';
import { Reporter } from '../../types/MetricsOptions';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import { KialiIcon } from 'config/KialiIcon';
import { getOptions, clickHandler } from 'components/CytoscapeGraph/ContextMenu/NodeContextMenu';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { edgesIn, edgesOut, select, selectAnd, selectOr } from 'helpers/GraphHelpers';
import { classes } from 'typestyle';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from './SummaryPanelStyle';
import { isMultiCluster, serverConfig } from 'config';
import {
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement
} from '@patternfly/react-core';
import { kebabToggleStyle } from 'styles/DropdownStyles';
import { kialiStyle } from 'styles/StyleUtils';
import { ApiResponse } from 'types/Api';

type SummaryPanelAppBoxMetricsState = {
  grpcReceivedIn: Datapoint[];
  grpcReceivedOut: Datapoint[];
  grpcRequestErrIn: Datapoint[];
  grpcRequestErrOut: Datapoint[];
  grpcRequestIn: Datapoint[];
  grpcRequestOut: Datapoint[];
  grpcSentIn: Datapoint[];
  grpcSentOut: Datapoint[];
  httpRequestErrIn: Datapoint[];
  httpRequestErrOut: Datapoint[];
  httpRequestIn: Datapoint[];
  httpRequestOut: Datapoint[];
  tcpReceivedIn: Datapoint[];
  tcpReceivedOut: Datapoint[];
  tcpSentIn: Datapoint[];
  tcpSentOut: Datapoint[];
};

type SummaryPanelAppBoxState = SummaryPanelAppBoxMetricsState & {
  appBox: any;
  isOpen: boolean;
  loading: boolean;
  metricsLoadError: string | null;
};

const defaultMetricsState: SummaryPanelAppBoxMetricsState = {
  grpcReceivedIn: [],
  grpcReceivedOut: [],
  grpcRequestErrIn: [],
  grpcRequestErrOut: [],
  grpcRequestIn: [],
  grpcRequestOut: [],
  grpcSentIn: [],
  grpcSentOut: [],
  httpRequestErrIn: [],
  httpRequestErrOut: [],
  httpRequestIn: [],
  httpRequestOut: [],
  tcpReceivedIn: [],
  tcpReceivedOut: [],
  tcpSentIn: [],
  tcpSentOut: []
};

const defaultState: SummaryPanelAppBoxState = {
  appBox: null,
  isOpen: false,
  loading: false,
  metricsLoadError: null,
  ...defaultMetricsState
};

const nodeInfoStyle = kialiStyle({
  display: 'flex',
  marginTop: '0.25rem'
});

export class SummaryPanelAppBox extends React.Component<SummaryPanelPropType, SummaryPanelAppBoxState> {
  private metricsPromise?: CancelablePromise<ApiResponse<IstioMetricsMap>[]>;
  private readonly mainDivRef: React.RefObject<HTMLDivElement>;

  constructor(props: SummaryPanelPropType) {
    super(props);
    this.state = { ...defaultState };

    this.mainDivRef = React.createRef<HTMLDivElement>();
  }

  static getDerivedStateFromProps(
    props: SummaryPanelPropType,
    state: SummaryPanelAppBoxState
  ): Partial<SummaryPanelAppBoxState> | null {
    // if the summaryTarget (i.e. selected appBox) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.data.summaryTarget !== state.appBox
      ? { appBox: props.data.summaryTarget, loading: true, ...defaultMetricsState }
      : null;
  }

  componentDidMount(): void {
    this.updateCharts(this.props);
  }

  componentDidUpdate(prevProps: SummaryPanelPropType): void {
    if (prevProps.data.summaryTarget !== this.props.data.summaryTarget) {
      if (this.mainDivRef.current) {
        this.mainDivRef.current.scrollTop = 0;
      }
    }

    if (shouldRefreshData(prevProps, this.props)) {
      this.updateCharts(this.props);
    }
  }

  componentWillUnmount(): void {
    if (this.metricsPromise) {
      this.metricsPromise.cancel();
    }
  }

  render(): React.ReactNode {
    const appBox = this.props.data.summaryTarget;
    const nodeData = appBox.getData();

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

    const options = getOptions(nodeData);
    const items = [
      <DropdownGroup key="show" label="Show">
        {options.map((o, i) => {
          return (
            <DropdownItem key={`option-${i}`} onClick={() => clickHandler(o, this.props.kiosk)}>
              {o.text} {o.target === '_blank' && <ExternalLinkAltIcon />}
            </DropdownItem>
          );
        })}
      </DropdownGroup>
    ];

    const firstBadge = isMultiCluster ? (
      <>
        <PFBadge badge={PFBadges.Cluster} size="sm" style={{ marginBottom: '0.125rem' }} />
        {nodeData.cluster}
      </>
    ) : (
      <>
        <PFBadge badge={PFBadges.Namespace} size="sm" style={{ marginBottom: '0.125rem' }} />
        {nodeData.namespace}
      </>
    );

    const secondBadge = isMultiCluster ? (
      <div>
        <PFBadge badge={PFBadges.Namespace} size="sm" style={{ marginBottom: '0.125rem' }} />
        {nodeData.namespace}
      </div>
    ) : (
      <></>
    );

    return (
      <div ref={this.mainDivRef} className={classes(panelStyle, summaryPanel)}>
        <div className={panelHeadingStyle}>
          {getTitle('Application')}

          <span>
            {firstBadge}

            {options.length > 0 && (
              <Dropdown
                id="summary-appbox-actions"
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle
                    ref={toggleRef}
                    id="summary-appbox-kebab"
                    className={kebabToggleStyle}
                    aria-label="Actions"
                    variant="plain"
                    onClick={() => this.onToggleActions(!this.state.isOpen)}
                    isExpanded={this.state.isOpen}
                    style={{ float: 'right' }}
                  >
                    <KialiIcon.KebabToggle />
                  </MenuToggle>
                )}
                isOpen={this.state.isOpen}
                onOpenChange={(isOpen: boolean) => this.onToggleActions(isOpen)}
                popperProps={{ position: 'right' }}
              >
                <DropdownList>{items}</DropdownList>
              </Dropdown>
            )}

            {secondBadge}

            <div className={nodeInfoStyle}>
              {renderBadgedLink(nodeData)}
              {renderHealth(nodeData.health)}
            </div>
          </span>

          <div>
            {this.renderBadgeSummary(appBox)}
            {serviceList.length > 0 && <div>{serviceList}</div>}
            {workloadList.length > 0 && <div> {workloadList}</div>}
          </div>
        </div>

        <div className={panelBodyStyle}>
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

  private onToggleActions = (isExpanded: boolean): void => {
    this.setState({ isOpen: isExpanded });
  };

  private updateCharts = (props: SummaryPanelPropType): void => {
    const appBox = props.data.summaryTarget;
    const nodeData = appBox.getData() as DecoratedGraphNodeData;
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
    let promiseInRps: Promise<ApiResponse<IstioMetricsMap>> = Promise.resolve({ data: {} });
    let promiseInStream: Promise<ApiResponse<IstioMetricsMap>> = Promise.resolve({ data: {} });

    if (this.hasHttpIn(appBox) || (this.hasGrpcIn(appBox) && isGrpcRequests)) {
      const filtersRps = ['request_count', 'request_error_count'];

      promiseInRps = getNodeMetrics(
        nodeMetricType,
        nodeData,
        props,
        filtersRps,
        'inbound',
        'destination',
        serverConfig.ambientEnabled, // TODO change to nodeData.isAmbient when it is set for all node types
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
          nodeData,
          props,
          filtersStream,
          'inbound',
          'source',
          serverConfig.ambientEnabled, // TODO change to "nodeData.isAmbient" when it is set for this node type
          undefined,
          undefined,
          byLabelsStream
        );
      }
    }

    const promiseIn = mergeMetricsResponses([promiseInRps, promiseInStream]);
    let promiseOut: Promise<ApiResponse<IstioMetricsMap>> = Promise.resolve({ data: {} });

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
          nodeData,
          props,
          filters,
          'outbound',
          reporter,
          serverConfig.ambientEnabled, // TODO change to "nodeData.isAmbient" when it is set for this node type
          undefined,
          undefined,
          byLabels
        );
      }
    }

    // use dest metrics for inbound
    this.metricsPromise = makeCancelablePromise(Promise.all([promiseOut, promiseIn]));

    this.metricsPromise.promise
      .then((responses: ApiResponse<IstioMetricsMap>[]) => {
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

  private renderBadgeSummary = (appBox): React.ReactNode => {
    const appBoxData = appBox.getData();

    let hasCB: boolean = appBoxData[NodeAttr.hasCB] === true;
    let hasVS: boolean = appBoxData[NodeAttr.hasVS] === true;

    const appBoxChildren = appBox.getAllNodeChildren();

    selectOr(appBoxChildren, [
      [{ prop: NodeAttr.hasCB, op: 'truthy' }],
      [{ prop: NodeAttr.hasVS, op: 'truthy' }]
    ]).forEach(n => {
      hasCB = hasCB || !!n.getData()[NodeAttr.hasCB];
      hasVS = hasVS || !!n.getData()[NodeAttr.hasVS];
    });

    return (
      <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
        {hasCB && (
          <div>
            <KialiIcon.CircuitBreaker />
            <span style={{ paddingLeft: '0.25rem' }}>Has Circuit Breaker</span>
          </div>
        )}

        {hasVS && (
          <div>
            <KialiIcon.VirtualService />
            <span style={{ paddingLeft: '0.25rem' }}>Has Virtual Service</span>
          </div>
        )}
      </div>
    );
  };

  private renderGrpcRequests = (appBox): React.ReactNode => {
    // only consider the physical children to avoid inflated rates
    const appBoxChildren = appBox.getAllNodeChildren();

    const validChildren = selectAnd(appBoxChildren, [
      { prop: NodeAttr.nodeType, op: '!=', val: NodeType.SERVICE },
      { prop: NodeAttr.nodeType, op: '!=', val: NodeType.AGGREGATE }
    ]);

    const inbound = getAccumulatedTrafficRateGrpc(edgesIn(validChildren as Node[]));
    const outbound = getAccumulatedTrafficRateGrpc(edgesOut(validChildren as Node[]));

    return (
      <InOutRateTableGrpc
        title="GRPC Traffic (requests per second):"
        inRate={inbound.rate}
        inRateGrpcErr={inbound.rateGrpcErr}
        inRateNR={inbound.rateNoResponse}
        outRate={outbound.rate}
        outRateGrpcErr={outbound.rateGrpcErr}
        outRateNR={outbound.rateNoResponse}
      />
    );
  };

  private renderHttpRequests = (appBox): React.ReactNode => {
    // only consider the physical children to avoid inflated rates
    const appBoxChildren = appBox.getAllNodeChildren();

    const validChildren = selectAnd(appBoxChildren, [
      { prop: NodeAttr.nodeType, op: '!=', val: NodeType.SERVICE },
      { prop: NodeAttr.nodeType, op: '!=', val: NodeType.AGGREGATE }
    ]);

    const inbound = getAccumulatedTrafficRateHttp(edgesIn(validChildren as Node[]));
    const outbound = getAccumulatedTrafficRateHttp(edgesOut(validChildren as Node[]));

    return (
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
    );
  };

  private renderSparklines = (appBox): React.ReactNode => {
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

    let grpcCharts: React.ReactNode, httpCharts: React.ReactNode, tcpCharts: React.ReactNode;

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

  private renderServiceList = (appBox): React.ReactNode[] => {
    // likely 0 or 1 but support N in case of unanticipated labeling
    const serviceList: React.ReactNode[] = [];

    const appBoxChildren = appBox.getAllNodeChildren();

    select(appBoxChildren, { prop: NodeAttr.nodeType, val: NodeType.SERVICE }).forEach((serviceNode, i) => {
      const serviceNodeData = serviceNode.getData();
      serviceList.push(renderBadgedLink(serviceNodeData, NodeType.SERVICE));

      const aggregates = selectAnd(appBoxChildren, [
        { prop: NodeAttr.nodeType, val: NodeType.AGGREGATE },
        { prop: NodeAttr.service, val: serviceNodeData.service }
      ]);

      if (!!aggregates && aggregates.length > 0) {
        const aggregateList: React.ReactNode[] = [];

        aggregates.forEach(aggregateNode => {
          const aggregateNodeData = aggregateNode.getData();
          aggregateList.push(renderBadgedLink(aggregateNodeData, NodeType.AGGREGATE));
        });

        serviceList.push(<div key={`service-${i}`}>{aggregateList}</div>);
      }
    });

    return serviceList;
  };

  private renderWorkloadList = (appBox): React.ReactNode[] => {
    const workloadList: React.ReactNode[] = [];

    const appBoxChildren = appBox.getAllNodeChildren();

    select(appBoxChildren, { prop: NodeAttr.workload, op: 'truthy' }).forEach(node => {
      const nodeData = node.getData();
      workloadList.push(renderBadgedLink(nodeData, NodeType.WORKLOAD));
    });

    return workloadList;
  };

  private isGrpcRequests = (): boolean => {
    return this.props.trafficRates.includes(TrafficRate.GRPC_REQUEST);
  };

  private hasGrpcTraffic = (appBox: any): boolean => {
    const appBoxChildren = (appBox as Node).getAllNodeChildren();
    const notServices = select(appBoxChildren, { prop: NodeAttr.nodeType, op: '!=', val: NodeType.SERVICE });

    return (
      selectOr(notServices, [
        [{ prop: NodeAttr.grpcIn, op: '>', val: 0 }],
        [{ prop: NodeAttr.grpcOut, op: '>', val: 0 }]
      ]).length > 0
    );
  };

  private hasGrpcIn = (appBox: any): boolean => {
    const appBoxChildren = (appBox as Node).getAllNodeChildren();

    return (
      selectAnd(appBoxChildren, [
        { prop: NodeAttr.nodeType, op: '!=', val: NodeType.SERVICE },
        { prop: NodeAttr.grpcIn, op: '>', val: 0 }
      ]).length > 0
    );
  };

  private hasGrpcOut = (appBox: any): boolean => {
    const appBoxChildren = (appBox as Node).getAllNodeChildren();

    return (
      selectAnd(appBoxChildren, [
        { prop: NodeAttr.nodeType, op: '!=', val: NodeType.SERVICE },
        { prop: NodeAttr.grpcOut, op: '>', val: 0 }
      ]).length > 0
    );
  };

  private hasHttpTraffic = (appBox: any): boolean => {
    const appBoxChildren = (appBox as Node).getAllNodeChildren();
    const notServices = select(appBoxChildren, { prop: NodeAttr.nodeType, op: '!=', val: NodeType.SERVICE });

    return (
      selectOr(notServices, [
        [{ prop: NodeAttr.httpIn, op: '>', val: 0 }],
        [{ prop: NodeAttr.httpOut, op: '>', val: 0 }]
      ]).length > 0
    );
  };

  private hasHttpIn = (appBox: any): boolean => {
    const appBoxChildren = (appBox as Node).getAllNodeChildren();

    return (
      selectAnd(appBoxChildren, [
        { prop: NodeAttr.nodeType, op: '!=', val: NodeType.SERVICE },
        { prop: NodeAttr.httpIn, op: '>', val: 0 }
      ]).length > 0
    );
  };

  private hasHttpOut = (appBox: any): boolean => {
    const appBoxChildren = (appBox as Node).getAllNodeChildren();

    return (
      selectAnd(appBoxChildren, [
        { prop: NodeAttr.nodeType, op: '!=', val: NodeType.SERVICE },
        { prop: NodeAttr.httpOut, op: '>', val: 0 }
      ]).length > 0
    );
  };

  private hasTcpTraffic = (appBox: any): boolean => {
    const appBoxChildren = (appBox as Node).getAllNodeChildren();
    const notServices = select(appBoxChildren, { prop: NodeAttr.nodeType, op: '!=', val: NodeType.SERVICE });

    return (
      selectOr(notServices, [[{ prop: NodeAttr.tcpIn, op: '>', val: 0 }], [{ prop: NodeAttr.tcpOut, op: '>', val: 0 }]])
        .length > 0
    );
  };

  private hasTcpIn = (appBox: any): boolean => {
    const appBoxChildren = (appBox as Node).getAllNodeChildren();

    return (
      selectAnd(appBoxChildren, [
        { prop: NodeAttr.nodeType, op: '!=', val: NodeType.SERVICE },
        { prop: NodeAttr.tcpIn, op: '>', val: 0 }
      ]).length > 0
    );
  };

  private hasTcpOut = (appBox: any): boolean => {
    const appBoxChildren = (appBox as Node).getAllNodeChildren();

    return (
      selectAnd(appBoxChildren, [
        { prop: NodeAttr.nodeType, op: '!=', val: NodeType.SERVICE },
        { prop: NodeAttr.tcpOut, op: '>', val: 0 }
      ]).length > 0
    );
  };
}

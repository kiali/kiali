import * as React from 'react';
import { Tab, Tooltip } from '@patternfly/react-core';
import { Node, Visualization } from '@patternfly/react-topology';
import { kialiStyle } from 'styles/StyleUtils';
import _ from 'lodash';
import { RateTableGrpc, RateTableHttp, RateTableTcp } from '../../components/SummaryPanel/RateTable';
import { RequestChart, StreamChart } from '../../components/SummaryPanel/RpsChart';
import { NodeAttr, NodeType, Protocol, SummaryPanelPropType, TrafficRate, UNKNOWN } from '../../types/Graph';
import {
  getAccumulatedTrafficRateGrpc,
  getAccumulatedTrafficRateHttp,
  getAccumulatedTrafficRateTcp,
  TrafficRateGrpc,
  TrafficRateHttp,
  TrafficRateTcp
} from '../../utils/TrafficRate';
import * as API from '../../services/Api';
import {
  getDatapoints,
  getFirstDatapoints,
  getTitle,
  hr,
  noTrafficStyle,
  shouldRefreshData,
  summaryBodyTabs,
  summaryFont,
  summaryPanelWidth
} from './SummaryPanelCommon';
import { Datapoint, IstioMetricsMap, Labels } from '../../types/Metrics';
import { CancelablePromise, makeCancelablePromise, PromisesRegistry } from '../../utils/CancelablePromises';
import { KialiIcon } from 'config/KialiIcon';
import { serverConfig } from '../../config/ServerConfig';
import { ValidationStatus } from 'types/IstioObjects';
import { ValidationSummary } from 'components/Validations/ValidationSummary';
import { ValidationSummaryLink } from '../../components/Link/ValidationSummaryLink';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { edgesIn, edgesOut, elems, leafNodes, NodeData, select } from 'pages/GraphPF/GraphPFElems';
import { SimpleTabs } from 'components/Tab/SimpleTabs';
import { panelHeadingStyle, panelStyle } from './SummaryPanelStyle';
import { ApiResponse } from 'types/Api';

type SummaryPanelGraphMetricsState = {
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

// TODO replace with real type
type ValidationsMap = Map<string, ValidationStatus>;

type SummaryPanelGraphState = SummaryPanelGraphMetricsState & {
  graph: any;
  loading: boolean;
  metricsLoadError: string | null;
  validationsMap: ValidationsMap;
};

type SummaryPanelGraphTraffic = {
  grpcIn: TrafficRateGrpc;
  grpcOut: TrafficRateGrpc;
  grpcTotal: TrafficRateGrpc;
  httpIn: TrafficRateHttp;
  httpOut: TrafficRateHttp;
  httpTotal: TrafficRateHttp;
  isGrpcRequests: boolean;
  tcpIn: TrafficRateTcp;
  tcpOut: TrafficRateTcp;
  tcpTotal: TrafficRateTcp;
};

const defaultMetricsState: SummaryPanelGraphMetricsState = {
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

const defaultState: SummaryPanelGraphState = {
  graph: null,
  loading: false,
  metricsLoadError: null,
  validationsMap: new Map<string, ValidationStatus>(),
  ...defaultMetricsState
};

const topologyStyle = kialiStyle({
  marginLeft: '0.25rem',
  marginRight: '0.5rem'
});

const namespaceStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center'
});

export class SummaryPanelGraph extends React.Component<SummaryPanelPropType, SummaryPanelGraphState> {
  static readonly panelStyle = {
    height: '100%',
    margin: 0,
    minWidth: summaryPanelWidth,
    overflowY: 'auto' as 'auto',
    width: summaryPanelWidth
  };

  private graphTraffic?: SummaryPanelGraphTraffic;
  private isPF = false;
  private metricsPromise?: CancelablePromise<ApiResponse<IstioMetricsMap>[]>;
  private validationSummaryPromises: PromisesRegistry = new PromisesRegistry();

  constructor(props: SummaryPanelPropType) {
    super(props);

    this.isPF = !!props.data.isPF;
    this.state = { ...defaultState };
  }

  static getDerivedStateFromProps(
    props: SummaryPanelPropType,
    state: SummaryPanelGraphState
  ): Partial<SummaryPanelGraphState> | null {
    // if the summaryTarget (i.e. graph) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.data.summaryTarget !== state.graph
      ? { graph: props.data.summaryTarget, loading: true, ...defaultMetricsState }
      : null;
  }

  componentDidMount(): void {
    if (this.shouldShowCharts()) {
      this.graphTraffic = this.getGraphTraffic();
      this.updateCharts();
    }
    this.updateValidations();
  }

  componentDidUpdate(prevProps: SummaryPanelPropType): void {
    if (shouldRefreshData(prevProps, this.props)) {
      if (this.shouldShowCharts()) {
        this.graphTraffic = this.getGraphTraffic();
        this.updateCharts();
      }
      this.updateValidations();
    }
  }

  componentWillUnmount(): void {
    if (this.metricsPromise) {
      this.metricsPromise.cancel();
    }
    if (this.validationSummaryPromises) {
      this.validationSummaryPromises.cancelAll();
    }
  }

  render(): React.ReactNode {
    let numSvc: number,
      numWorkloads: number,
      numApps: number,
      numVersions: number,
      numEdges: number,
      grpcIn: TrafficRateGrpc,
      grpcOut: TrafficRateGrpc,
      grpcTotal: TrafficRateGrpc,
      httpIn: TrafficRateHttp,
      httpOut: TrafficRateHttp,
      httpTotal: TrafficRateHttp,
      isGrpcRequests: boolean,
      tcpIn: TrafficRateTcp,
      tcpOut: TrafficRateTcp,
      tcpTotal: TrafficRateTcp;

    if (this.isPF) {
      // PF Graph
      const controller = this.props.data.summaryTarget as Visualization;

      if (!controller) {
        return null;
      }
      const { nodes, edges } = elems(controller);

      numSvc = select(nodes, { prop: NodeAttr.nodeType, val: NodeType.SERVICE }).length;
      numWorkloads = select(nodes, { prop: NodeAttr.nodeType, val: NodeType.WORKLOAD }).length;

      ({ numApps, numVersions } = this.countApps());
      numEdges = edges.length;

      ({ grpcIn, grpcOut, grpcTotal, httpIn, httpOut, httpTotal, isGrpcRequests, tcpIn, tcpOut, tcpTotal } =
        this.graphTraffic ?? this.getGraphTraffic());
    } else {
      // CY Graph
      const cy = this.props.data.summaryTarget;

      if (!cy) {
        return null;
      }

      numSvc = cy.nodes(`[nodeType = "${NodeType.SERVICE}"]`).size();
      numWorkloads = cy.nodes(`[nodeType = "${NodeType.WORKLOAD}"]`).size();

      ({ numApps, numVersions } = this.countApps());
      numEdges = cy.edges().size();

      ({ grpcIn, grpcOut, grpcTotal, httpIn, httpOut, httpTotal, isGrpcRequests, tcpIn, tcpOut, tcpTotal } =
        this.graphTraffic ?? this.getGraphTraffic());
    }

    const tooltipInboundRef = React.createRef();
    const tooltipOutboundRef = React.createRef();
    const tooltipTotalRef = React.createRef();

    return (
      <div id="summary-panel-graph" className={panelStyle} style={SummaryPanelGraph.panelStyle}>
        <div id="summary-panel-graph-heading" className={panelHeadingStyle}>
          {getTitle('Current Graph')}
          {this.renderNamespacesSummary()}
          {this.renderTopologySummary(numSvc, numWorkloads, numApps, numVersions, numEdges)}
        </div>

        <div className={summaryBodyTabs}>
          <SimpleTabs id="graph_summary_tabs" defaultTab={0} style={{ paddingBottom: '0.5rem' }}>
            <Tooltip
              id="tooltip-inbound"
              content="Traffic entering from traffic sources."
              entryDelay={1250}
              triggerRef={tooltipInboundRef}
            />

            <Tooltip
              id="tooltip-outbound"
              content="Traffic exiting the requested namespaces."
              entryDelay={1250}
              triggerRef={tooltipOutboundRef}
            />

            <Tooltip
              id="tooltip-total"
              content="All inbound, outbound and traffic within the requested namespaces."
              entryDelay={1250}
              triggerRef={tooltipTotalRef}
            />

            <Tab style={summaryFont} title="Inbound" eventKey={0} ref={tooltipInboundRef}>
              <div style={summaryFont}>
                {grpcIn.rate === 0 && httpIn.rate === 0 && tcpIn.rate === 0 && (
                  <div className={noTrafficStyle}>
                    <KialiIcon.Info /> No inbound traffic.
                  </div>
                )}

                {grpcIn.rate > 0 && isGrpcRequests && (
                  <RateTableGrpc
                    isRequests={isGrpcRequests}
                    rate={grpcIn.rate}
                    rateGrpcErr={grpcIn.rateGrpcErr}
                    rateNR={grpcIn.rateNoResponse}
                  />
                )}

                {httpIn.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={httpIn.rate}
                    rate3xx={httpIn.rate3xx}
                    rate4xx={httpIn.rate4xx}
                    rate5xx={httpIn.rate5xx}
                    rateNR={httpIn.rateNoResponse}
                  />
                )}

                {tcpIn.rate > 0 && <RateTableTcp rate={tcpIn.rate} />}
                {
                  // We don't show a sparkline here because we need to aggregate the traffic of an
                  // ad hoc set of [root] nodes. We don't have backend support for that aggregation.
                }
              </div>
            </Tab>
            <Tab style={summaryFont} title="Outbound" eventKey={1} ref={tooltipOutboundRef}>
              <div style={summaryFont}>
                {grpcOut.rate === 0 && httpOut.rate === 0 && tcpOut.rate === 0 && (
                  <div className={noTrafficStyle}>
                    <KialiIcon.Info /> No outbound traffic.
                  </div>
                )}

                {grpcOut.rate > 0 && (
                  <RateTableGrpc
                    isRequests={isGrpcRequests}
                    rate={grpcOut.rate}
                    rateGrpcErr={grpcOut.rateGrpcErr}
                    rateNR={grpcOut.rateNoResponse}
                  />
                )}

                {httpOut.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={httpOut.rate}
                    rate3xx={httpOut.rate3xx}
                    rate4xx={httpOut.rate4xx}
                    rate5xx={httpOut.rate5xx}
                    rateNR={httpOut.rateNoResponse}
                  />
                )}

                {tcpOut.rate > 0 && <RateTableTcp rate={tcpOut.rate} />}
                {
                  // We don't show a sparkline here because we need to aggregate the traffic of an
                  // ad hoc set of [root] nodes. We don't have backend support for that aggregation.
                }
              </div>
            </Tab>
            <Tab style={summaryFont} title="Total" eventKey={2} ref={tooltipTotalRef}>
              <div style={summaryFont}>
                {grpcTotal.rate === 0 && httpTotal.rate === 0 && tcpTotal.rate === 0 && (
                  <div className={noTrafficStyle}>
                    <KialiIcon.Info /> No traffic.
                  </div>
                )}

                {grpcTotal.rate > 0 && (
                  <RateTableGrpc
                    isRequests={isGrpcRequests}
                    rate={grpcTotal.rate}
                    rateGrpcErr={grpcTotal.rateGrpcErr}
                    rateNR={grpcTotal.rateNoResponse}
                  />
                )}

                {httpTotal.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={httpTotal.rate}
                    rate3xx={httpTotal.rate3xx}
                    rate4xx={httpTotal.rate4xx}
                    rate5xx={httpTotal.rate5xx}
                    rateNR={httpTotal.rateNoResponse}
                  />
                )}

                {tcpTotal.rate > 0 && <RateTableTcp rate={tcpTotal.rate} />}
                {this.shouldShowCharts() && (
                  <div>
                    {hr()}
                    {this.renderCharts()}
                  </div>
                )}
              </div>
            </Tab>
          </SimpleTabs>
        </div>
      </div>
    );
  }

  private getGraphTraffic = (): SummaryPanelGraphTraffic => {
    if (this.isPF) {
      return this.getGraphTrafficPF();
    }

    // when getting total traffic rates don't count requests from injected service nodes
    const cy = this.props.data.summaryTarget;
    const totalEdges = cy.nodes(`[nodeType != "${NodeType.SERVICE}"][!isBox]`).edgesTo('*');
    const inboundEdges = cy.nodes(`[?${NodeAttr.isRoot}]`).edgesTo('*');
    const outboundEdges = cy
      .nodes()
      .leaves(`node[?${NodeAttr.isOutside}],[?${NodeAttr.isServiceEntry}]`)
      .connectedEdges();

    return {
      grpcIn: getAccumulatedTrafficRateGrpc(inboundEdges),
      grpcOut: getAccumulatedTrafficRateGrpc(outboundEdges),
      grpcTotal: getAccumulatedTrafficRateGrpc(totalEdges),
      httpIn: getAccumulatedTrafficRateHttp(inboundEdges),
      httpOut: getAccumulatedTrafficRateHttp(outboundEdges),
      httpTotal: getAccumulatedTrafficRateHttp(totalEdges),
      isGrpcRequests: this.props.trafficRates.includes(TrafficRate.GRPC_REQUEST),
      tcpIn: getAccumulatedTrafficRateTcp(inboundEdges),
      tcpOut: getAccumulatedTrafficRateTcp(outboundEdges),
      tcpTotal: getAccumulatedTrafficRateTcp(totalEdges)
    };
  };

  private getGraphTrafficPF = (): SummaryPanelGraphTraffic => {
    const controller = this.props.data.summaryTarget as Visualization;
    const { nodes } = elems(controller);

    // when getting total traffic rates don't count requests from injected service nodes
    const nonServiceNodes = select(nodes, { prop: NodeAttr.nodeType, val: NodeType.SERVICE, op: '!=' });
    const nonBoxNodes = select(nonServiceNodes, { prop: NodeAttr.isBox, op: 'falsy' });
    const totalEdges = edgesOut(nonBoxNodes as Node[]).length;
    const inboundEdges = edgesOut(select(nodes, { prop: NodeAttr.isRoot, op: 'truthy' }) as Node[]);
    const allLeafNodes = leafNodes(nodes) as Node[];
    const outboundEdges = edgesIn(
      _.union(
        select(allLeafNodes, { prop: NodeAttr.isOutside, op: 'truthy' }),
        select(allLeafNodes, { prop: NodeAttr.isServiceEntry, op: 'truthy' })
      ) as Node[]
    );

    return {
      grpcIn: getAccumulatedTrafficRateGrpc(inboundEdges, true),
      grpcOut: getAccumulatedTrafficRateGrpc(outboundEdges, true),
      grpcTotal: getAccumulatedTrafficRateGrpc(totalEdges, true),
      httpIn: getAccumulatedTrafficRateHttp(inboundEdges, true),
      httpOut: getAccumulatedTrafficRateHttp(outboundEdges, true),
      httpTotal: getAccumulatedTrafficRateHttp(totalEdges, true),
      isGrpcRequests: this.props.trafficRates.includes(TrafficRate.GRPC_REQUEST),
      tcpIn: getAccumulatedTrafficRateTcp(inboundEdges, true),
      tcpOut: getAccumulatedTrafficRateTcp(outboundEdges, true),
      tcpTotal: getAccumulatedTrafficRateTcp(totalEdges, true)
    };
  };

  private countApps = (): { numApps: number; numVersions: number } => {
    if (this.isPF) {
      return this.countAppsPF();
    }

    const cy = this.props.data.summaryTarget;
    const appVersions: { [key: string]: Set<string> } = {};

    cy.$(`node[nodeType = "${NodeType.APP}"]`).forEach(node => {
      const app = node.data(NodeAttr.app);

      if (appVersions[app] === undefined) {
        appVersions[app] = new Set();
      }

      appVersions[app].add(node.data(NodeAttr.version));
    });

    return {
      numApps: Object.getOwnPropertyNames(appVersions).length,
      numVersions: Object.getOwnPropertyNames(appVersions).reduce((totalCount: number, version: string) => {
        return totalCount + appVersions[version].size;
      }, 0)
    };
  };

  private countAppsPF = (): { numApps: number; numVersions: number } => {
    const controller = this.props.data.summaryTarget as Visualization;
    const { nodes } = elems(controller);

    const appVersions: { [key: string]: Set<string> } = {};

    select(nodes, { prop: NodeAttr.nodeType, val: NodeType.APP }).forEach(appNode => {
      const d = appNode.getData() as NodeData;
      const app = d[NodeAttr.app];

      if (appVersions[app] === undefined) {
        appVersions[app] = new Set();
      }

      appVersions[app].add(d[NodeAttr.version]);
    });

    return {
      numApps: Object.getOwnPropertyNames(appVersions).length,
      numVersions: Object.getOwnPropertyNames(appVersions).reduce((totalCount: number, version: string) => {
        return totalCount + appVersions[version].size;
      }, 0)
    };
  };

  private renderNamespacesSummary = (): React.ReactNode => {
    return (
      <div style={{ marginBottom: '1rem' }}>
        {this.props.namespaces.map(namespace => this.renderNamespace(namespace.name))}
      </div>
    );
  };

  private renderValidations = (ns: string): React.ReactNode => {
    const validation = this.state.validationsMap.get(ns);
    if (validation === undefined) {
      return undefined;
    }

    return (
      <div style={{ marginLeft: '0.25rem' }}>
        <ValidationSummaryLink
          namespace={ns}
          objectCount={validation.objectCount}
          errors={validation.errors}
          warnings={validation.warnings}
        >
          <ValidationSummary
            id={`ns-val-${ns}`}
            errors={validation.errors}
            warnings={validation.warnings}
            objectCount={validation.objectCount}
            type="istio"
          />
        </ValidationSummaryLink>
      </div>
    );
  };

  private renderNamespace = (ns: string): React.ReactNode => {
    return (
      <div key={`rf-${ns}`} id={`ns-${ns}`} className={namespaceStyle}>
        <PFBadge badge={PFBadges.Namespace} size="sm" />
        {ns} {this.renderValidations(ns)}
      </div>
    );
  };

  private renderTopologySummary = (
    numSvc: number,
    numWorkloads: number,
    numApps: number,
    numVersions: number,
    numEdges: number
  ): React.ReactNode => (
    <>
      {numApps > 0 && (
        <div>
          <KialiIcon.Applications className={topologyStyle} />
          {numApps.toString()} {numApps === 1 ? 'app ' : 'apps '}
          {numVersions > 0 && `(${numVersions} versions)`}
        </div>
      )}

      {numSvc > 0 && (
        <div>
          <KialiIcon.Services className={topologyStyle} />
          {numSvc.toString()} {numSvc === 1 ? 'service' : 'services'}
        </div>
      )}

      {numWorkloads > 0 && (
        <div>
          <KialiIcon.Workloads className={topologyStyle} />
          {numWorkloads.toString()} {numWorkloads === 1 ? 'workload' : 'workloads'}
        </div>
      )}

      {numEdges > 0 && (
        <div>
          <KialiIcon.Topology className={topologyStyle} />
          {numEdges.toString()} {numEdges === 1 ? 'edge' : 'edges'}
        </div>
      )}
    </>
  );

  private shouldShowCharts(): boolean {
    // TODO we omit the charts when dealing with multiple namespaces. There is no backend
    // API support to gather the data. The whole-graph chart is of nominal value, it will likely be OK.
    return this.props.namespaces.length === 1;
  }

  private renderCharts = (): React.ReactNode => {
    if (this.state.loading) {
      return <strong>Loading chart...</strong>;
    } else if (this.state.metricsLoadError) {
      return (
        <div>
          <KialiIcon.Warning /> <strong>Error loading metrics: </strong>
          {this.state.metricsLoadError}
        </div>
      );
    }

    // When there is any traffic for the protocol, show both inbound and outbound charts. It's a little
    // confusing because for the tabs inbound is limited to just traffic entering the namespace, and outbound
    // is limited to just traffic exitingt the namespace.  But in the charts inbound ad outbound also
    // includes traffic within the namespace.
    const { grpcTotal, httpTotal, isGrpcRequests, tcpTotal } = this.graphTraffic!;

    return (
      <>
        {grpcTotal.rate > 0 && isGrpcRequests && (
          <>
            <RequestChart
              label="gRPC - Inbound Request Traffic"
              dataRps={this.state.grpcRequestIn}
              dataErrors={this.state.grpcRequestErrIn}
            />

            <RequestChart
              label="gRPC - Outbound Request Traffic"
              dataRps={this.state.grpcRequestOut}
              dataErrors={this.state.grpcRequestErrOut}
            />
          </>
        )}

        {grpcTotal.rate > 0 && !isGrpcRequests && (
          <>
            <StreamChart
              label="gRPC - Inbound Traffic"
              receivedRates={this.state.grpcReceivedIn}
              sentRates={this.state.grpcSentIn}
              unit="messages"
            />

            <StreamChart
              label="gRPC - Outbound Traffic"
              receivedRates={this.state.grpcReceivedOut}
              sentRates={this.state.grpcSentOut}
              unit="messages"
            />
          </>
        )}

        {httpTotal.rate > 0 && (
          <>
            <RequestChart
              label="HTTP - Inbound Request Traffic"
              dataRps={this.state.httpRequestIn}
              dataErrors={this.state.httpRequestErrIn}
            />

            <RequestChart
              label="HTTP - Outbound Request Traffic"
              dataRps={this.state.httpRequestOut}
              dataErrors={this.state.httpRequestErrOut}
            />
          </>
        )}

        {tcpTotal.rate > 0 && (
          <>
            <StreamChart
              label="TCP - Inbound Traffic"
              receivedRates={this.state.tcpReceivedIn}
              sentRates={this.state.tcpSentIn}
              unit="bytes"
            />

            <StreamChart
              label="TCP - Outbound Traffic"
              receivedRates={this.state.tcpReceivedOut}
              sentRates={this.state.tcpSentOut}
              unit="bytes"
            />
          </>
        )}
      </>
    );
  };

  private updateCharts = (): void => {
    const props: SummaryPanelPropType = this.props;
    const namespace = props.namespaces[0].name;

    if (namespace === UNKNOWN) {
      this.setState({
        loading: false
      });
      return;
    }

    // When there is any traffic for the protocol, show both inbound and outbound charts. It's a little
    // confusing because for the tabs inbound is limited to just traffic entering the namespace, and outbound
    // is limited to just traffic exitingt the namespace.  But in the charts inbound ad outbound also
    // includes traffic within the namespace.
    const { grpcTotal, httpTotal, isGrpcRequests, tcpTotal } = this.graphTraffic!;

    if (this.metricsPromise) {
      this.metricsPromise.cancel();
      this.metricsPromise = undefined;
    }

    let promiseIn: Promise<ApiResponse<IstioMetricsMap>> = Promise.resolve({ data: {} });
    let promiseOut: Promise<ApiResponse<IstioMetricsMap>> = Promise.resolve({ data: {} });

    let filters: string[] = [];

    if (grpcTotal.rate > 0 && !isGrpcRequests) {
      filters.push('grpc_sent', 'grpc_received');
    }

    if (httpTotal.rate > 0 || (grpcTotal.rate > 0 && isGrpcRequests)) {
      filters.push('request_count', 'request_error_count');
    }

    if (tcpTotal.rate > 0) {
      filters.push('tcp_sent', 'tcp_received');
    }

    if (filters.length > 0) {
      promiseIn = API.getNamespaceMetrics(namespace, {
        byLabels: ['request_protocol'], // ignored by prom if it doesn't exist
        direction: 'inbound',
        duration: props.duration,
        filters: filters,
        queryTime: props.queryTime,
        rateInterval: props.rateInterval,
        reporter: 'destination',
        step: props.step
      });

      promiseOut = API.getNamespaceMetrics(namespace, {
        byLabels: ['request_protocol'], // ignored by prom if it doesn't exist
        direction: 'outbound',
        duration: props.duration,
        filters: filters,
        queryTime: props.queryTime,
        rateInterval: props.rateInterval,
        reporter: 'source',
        step: props.step
      });
    }

    this.metricsPromise = makeCancelablePromise(Promise.all([promiseIn, promiseOut]));

    this.metricsPromise.promise
      .then(responses => {
        const comparator = (labels: Labels, protocol?: Protocol): boolean => {
          return protocol ? labels.request_protocol === protocol : true;
        };

        const metricsIn = responses[0].data;
        const metricsOut = responses[1].data;

        this.setState({
          loading: false,
          grpcReceivedIn: getFirstDatapoints(metricsIn.grpc_received),
          grpcReceivedOut: getFirstDatapoints(metricsOut.grpc_received),
          grpcRequestIn: getDatapoints(metricsIn.request_count, comparator, Protocol.GRPC),
          grpcRequestOut: getDatapoints(metricsOut.request_count, comparator, Protocol.GRPC),
          grpcRequestErrIn: getDatapoints(metricsIn.request_error_count, comparator, Protocol.GRPC),
          grpcRequestErrOut: getDatapoints(metricsOut.request_error_count, comparator, Protocol.GRPC),
          grpcSentIn: getFirstDatapoints(metricsIn.grpc_sent),
          grpcSentOut: getFirstDatapoints(metricsOut.grpc_sent),
          httpRequestIn: getDatapoints(metricsIn.request_count, comparator, Protocol.HTTP),
          httpRequestOut: getDatapoints(metricsOut.request_count, comparator, Protocol.HTTP),
          httpRequestErrIn: getDatapoints(metricsIn.request_error_count, comparator, Protocol.HTTP),
          httpRequestErrOut: getDatapoints(metricsOut.request_error_count, comparator, Protocol.HTTP),
          tcpReceivedIn: getFirstDatapoints(metricsIn.tcp_received),
          tcpReceivedOut: getFirstDatapoints(metricsOut.tcp_received),
          tcpSentIn: getFirstDatapoints(metricsIn.tcp_sent),
          tcpSentOut: getFirstDatapoints(metricsOut.tcp_sent)
        });
      })
      .catch(error => {
        if (error.isCanceled) {
          console.debug('SummaryPanelGraph: Ignore fetch error (canceled).');
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

  private updateValidations = (): void => {
    const namespacesAsString = this.props.namespaces.map(ns => ns.name).join(',');
    const promises = Object.keys(serverConfig.clusters).map(cluster =>
      API.getConfigValidations(namespacesAsString, cluster)
    );
    this.validationSummaryPromises
      .registerAll('validationSummary', promises)
      .then(responses => {
        const validationsMap = new Map<string, ValidationStatus>();
        responses.forEach((response: ApiResponse<ValidationStatus[]>) => {
          response.data.forEach(validationSummary => {
            // Merge validations across clusters for the same namespace.
            if (!validationSummary.namespace) {
              return;
            }

            const currentValidation = validationsMap.get(validationSummary.namespace);
            if (currentValidation) {
              validationSummary.errors += currentValidation.errors;
              validationSummary.warnings += currentValidation.warnings;
              if (currentValidation.objectCount !== undefined && validationSummary.objectCount !== undefined) {
                validationSummary.objectCount += currentValidation.objectCount;
              } else if (validationSummary.objectCount !== undefined) {
                validationSummary.objectCount = currentValidation.objectCount;
              }
            }

            validationsMap.set(validationSummary.namespace, validationSummary);
          });
        });
        this.setState({ validationsMap });
      })

      .catch(err => {
        if (!err.isCanceled) {
          console.log(`SummaryPanelGraph: Error fetching validation status: ${API.getErrorString(err)}`);
        }
      });
  };
}

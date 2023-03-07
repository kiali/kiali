import * as React from 'react';
import { Tab, Tooltip } from '@patternfly/react-core';
import { style } from 'typestyle';
import { RateTableGrpc, RateTableHttp, RateTableTcp } from '../../components/SummaryPanel/RateTable';
import { RequestChart, StreamChart } from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType, NodeType, TrafficRate, Protocol, UNKNOWN } from '../../types/Graph';
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
  shouldRefreshData,
  getFirstDatapoints,
  summaryFont,
  summaryHeader,
  summaryBodyTabs,
  hr,
  getDatapoints,
  summaryPanelWidth,
  getTitle
} from './SummaryPanelCommon';
import { Response } from '../../services/Api';
import { IstioMetricsMap, Datapoint, Labels } from '../../types/Metrics';
import { IstioMetricsOptions } from '../../types/MetricsOptions';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import { CyNode } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { KialiIcon } from 'config/KialiIcon';
import SimpleTabs from 'components/Tab/SimpleTabs';
import { ValidationStatus } from 'types/IstioObjects';
import { PFColors } from '../../components/Pf/PfColors';
import ValidationSummary from 'components/Validations/ValidationSummary';
import ValidationSummaryLink from '../../components/Link/ValidationSummaryLink';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';

type SummaryPanelNamespaceBoxMetricsState = {
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

type SummaryPanelNamespaceBoxState = SummaryPanelNamespaceBoxMetricsState & {
  loading: boolean;
  metricsLoadError: string | null;
  namespaceBox: any;
  validation: ValidationStatus | undefined;
};

type SummaryPanelNamespaceBoxTraffic = {
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

const defaultMetricsState: SummaryPanelNamespaceBoxMetricsState = {
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

const defaultState: SummaryPanelNamespaceBoxState = {
  loading: false,
  metricsLoadError: null,
  namespaceBox: null,
  validation: undefined,
  ...defaultMetricsState
};

const topologyStyle = style({
  margin: '0 1em'
});

export default class SummaryPanelNamespaceBox extends React.Component<
  SummaryPanelPropType,
  SummaryPanelNamespaceBoxState
> {
  static readonly panelStyle = {
    height: '100%',
    margin: 0,
    minWidth: summaryPanelWidth,
    overflowY: 'auto' as 'auto',
    backgroundColor: PFColors.White,
    width: summaryPanelWidth
  };

  private boxTraffic?: SummaryPanelNamespaceBoxTraffic;
  private metricsPromise?: CancelablePromise<Response<IstioMetricsMap>[]>;
  private validationPromise?: CancelablePromise<Response<ValidationStatus>>;

  constructor(props: SummaryPanelPropType) {
    super(props);

    this.state = { ...defaultState };
  }

  static getDerivedStateFromProps(props: SummaryPanelPropType, state: SummaryPanelNamespaceBoxState) {
    // if the summaryTarget (i.e. namespaceBox) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.data.summaryTarget !== state.namespaceBox
      ? { namespaceBox: props.data.summaryTarget, loading: true, ...defaultMetricsState }
      : null;
  }

  componentDidMount() {
    this.boxTraffic = this.getBoxTraffic();
    this.updateCharts();
    this.updateValidation();
  }

  componentDidUpdate(prevProps: SummaryPanelPropType) {
    if (shouldRefreshData(prevProps, this.props)) {
      this.boxTraffic = this.getBoxTraffic();
      this.updateCharts();
      this.updateValidation();
    }
  }

  componentWillUnmount() {
    if (this.metricsPromise) {
      this.metricsPromise.cancel();
    }
    if (this.validationPromise) {
      this.validationPromise.cancel();
    }
  }

  render() {
    const namespaceBox = this.props.data.summaryTarget;
    const boxed = namespaceBox.descendants();
    const namespace = namespaceBox.data(CyNode.namespace);

    const numSvc = boxed.filter(`node[nodeType = "${NodeType.SERVICE}"]`).size();
    const numWorkloads = boxed.filter(`node[nodeType = "${NodeType.WORKLOAD}"]`).size();
    const { numApps, numVersions } = this.countApps(boxed);
    const numEdges = boxed.connectedEdges().size();

    const { grpcIn, grpcOut, grpcTotal, httpIn, httpOut, httpTotal, isGrpcRequests, tcpIn, tcpOut, tcpTotal } =
      this.boxTraffic || this.getBoxTraffic();

    const tooltipInboundRef = React.createRef();
    const tooltipOutboundRef = React.createRef();
    const tooltipTotalRef = React.createRef();

    return (
      <div className="panel panel-default" style={SummaryPanelNamespaceBox.panelStyle}>
        <div className="panel-heading" style={summaryHeader}>
          {getTitle('Namespace')}
          {this.renderNamespace(namespace)}
          <br />
          {this.renderTopologySummary(numSvc, numWorkloads, numApps, numVersions, numEdges)}
        </div>
        <div className={summaryBodyTabs}>
          <SimpleTabs id="graph_summary_tabs" defaultTab={0} style={{ paddingBottom: '10px' }}>
            <Tooltip
              id="tooltip-inbound"
              content="Traffic entering from another namespace."
              entryDelay={1250}
              reference={tooltipInboundRef}
            />
            <Tooltip
              id="tooltip-outbound"
              content="Traffic exiting to another namespace."
              entryDelay={1250}
              reference={tooltipOutboundRef}
            />
            <Tooltip
              id="tooltip-total"
              content="All inbound, outbound and internal namespace traffic."
              entryDelay={1250}
              reference={tooltipTotalRef}
            />
            <Tab style={summaryFont} title="Inbound" eventKey={0} ref={tooltipInboundRef}>
              <div style={summaryFont}>
                {grpcIn.rate === 0 && httpIn.rate === 0 && tcpIn.rate === 0 && (
                  <>
                    <KialiIcon.Info /> No inbound traffic.
                  </>
                )}
                {grpcIn.rate > 0 && (
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
                  <>
                    <KialiIcon.Info /> No outbound traffic.
                  </>
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
                  <>
                    <KialiIcon.Info /> No traffic.
                  </>
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
                <div>
                  {hr()}
                  {this.renderCharts()}
                </div>
              </div>
            </Tab>
          </SimpleTabs>
        </div>
      </div>
    );
  }

  private getBoxTraffic = (): SummaryPanelNamespaceBoxTraffic => {
    const namespaceBox = this.props.data.summaryTarget;
    const boxed = namespaceBox.descendants();
    const namespace = namespaceBox.data(CyNode.namespace);
    const cluster = namespaceBox.data(CyNode.cluster);

    // inbound edges are from a different namespace or a different cluster
    const inboundEdges = namespaceBox
      .cy()
      .nodes(`[${CyNode.namespace} != "${namespace}"],[${CyNode.cluster} != "${cluster}"]`)
      .edgesTo(boxed);
    // outbound edges are to a different namespace or a different cluster
    const outboundEdges = boxed.edgesTo(`[${CyNode.namespace} != "${namespace}"],[${CyNode.cluster} != "${cluster}"]`);
    // total edges are inbound + edges from boxed workload|app|root nodes (i.e. not injected service nodes or box nodes)
    const totalEdges = inboundEdges.add(boxed.filter(`[?${CyNode.workload}]`).edgesTo('*'));

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

  private countApps = (boxed): { numApps: number; numVersions: number } => {
    const appVersions: { [key: string]: Set<string> } = {};

    boxed.filter(`node[nodeType = "${NodeType.APP}"]`).forEach(node => {
      const app = node.data(CyNode.app);
      if (appVersions[app] === undefined) {
        appVersions[app] = new Set();
      }
      appVersions[app].add(node.data(CyNode.version));
    });

    return {
      numApps: Object.getOwnPropertyNames(appVersions).length,
      numVersions: Object.getOwnPropertyNames(appVersions).reduce((totalCount: number, version: string) => {
        return totalCount + appVersions[version].size;
      }, 0)
    };
  };

  private renderNamespace = (ns: string) => {
    const validation = this.state.validation;
    return (
      <React.Fragment key={ns}>
        <span>
          <PFBadge badge={PFBadges.Namespace} size="sm" style={{ marginBottom: '2px' }} />
          {ns}{' '}
          {!!validation && (
            <ValidationSummaryLink
              namespace={ns}
              objectCount={validation.objectCount}
              errors={validation.errors}
              warnings={validation.warnings}
            >
              <ValidationSummary
                id={'ns-val-' + ns}
                errors={validation.errors}
                warnings={validation.warnings}
                objectCount={validation.objectCount}
                style={{ marginLeft: '5px' }}
              />
            </ValidationSummaryLink>
          )}
        </span>
        <br />
      </React.Fragment>
    );
  };

  private renderTopologySummary = (
    numSvc: number,
    numWorkloads: number,
    numApps: number,
    numVersions: number,
    numEdges: number
  ) => (
    <>
      {numApps > 0 && (
        <>
          <KialiIcon.Applications className={topologyStyle} />
          {numApps.toString()} {numApps === 1 ? 'app ' : 'apps '}
          {numVersions > 0 && `(${numVersions} versions)`}
          <br />
        </>
      )}
      {numSvc > 0 && (
        <>
          <KialiIcon.Services className={topologyStyle} />
          {numSvc.toString()} {numSvc === 1 ? 'service' : 'services'}
          <br />
        </>
      )}
      {numWorkloads > 0 && (
        <>
          <KialiIcon.Workloads className={topologyStyle} />
          {numWorkloads.toString()} {numWorkloads === 1 ? 'workload' : 'workloads'}
          <br />
        </>
      )}
      {numEdges > 0 && (
        <>
          <KialiIcon.Topology className={topologyStyle} />
          {numEdges.toString()} {numEdges === 1 ? 'edge' : 'edges'}
        </>
      )}
    </>
  );

  private renderCharts = () => {
    const props: SummaryPanelPropType = this.props;
    const namespace = props.data.summaryTarget.data(CyNode.namespace);

    if (this.state.loading) {
      return <strong>Loading chart...</strong>;
    } else if (this.state.metricsLoadError) {
      return (
        <div>
          <KialiIcon.Warning /> <strong>Error loading metrics: </strong>
          {this.state.metricsLoadError}
        </div>
      );
    } else if (namespace === UNKNOWN) {
      return <></>;
    }

    // When there is any traffic for the protocol, show both inbound and outbound charts. It's a little
    // confusing because for the tabs inbound is limited to just traffic entering the namespace, and outbound
    // is limited to just traffic exiting the namespace.  But in the charts inbound ad outbound also
    // includes traffic within the namespace.
    const { grpcTotal, httpTotal, isGrpcRequests, tcpTotal } = this.boxTraffic!;

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

  private updateCharts = () => {
    const props: SummaryPanelPropType = this.props;
    const namespace = props.data.summaryTarget.data(CyNode.namespace);

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
    const { grpcTotal, httpTotal, isGrpcRequests, tcpTotal } = this.boxTraffic!;

    if (this.metricsPromise) {
      this.metricsPromise.cancel();
      this.metricsPromise = undefined;
    }

    let promiseIn: Promise<Response<IstioMetricsMap>> = Promise.resolve({ data: {} });
    let promiseOut: Promise<Response<IstioMetricsMap>> = Promise.resolve({ data: {} });

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
      } as IstioMetricsOptions);
      promiseOut = API.getNamespaceMetrics(namespace, {
        byLabels: ['request_protocol'], // ignored by prom if it doesn't exist
        direction: 'outbound',
        duration: props.duration,
        filters: filters,
        queryTime: props.queryTime,
        rateInterval: props.rateInterval,
        reporter: 'source',
        step: props.step
      } as IstioMetricsOptions);
    }

    this.metricsPromise = makeCancelablePromise(Promise.all([promiseIn, promiseOut]));

    this.metricsPromise.promise
      .then(responses => {
        const comparator = (labels: Labels, protocol?: Protocol) => {
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
          console.debug('SummaryPanelNamespaceBox: Ignore fetch error (canceled).');
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

  private updateValidation = () => {
    const namespace = this.props.data.summaryTarget.data(CyNode.namespace);
    this.validationPromise = makeCancelablePromise(API.getNamespaceValidations(namespace));
    this.validationPromise.promise
      .then(rs => {
        this.setState({ validation: rs.data });
      })
      .catch(err => {
        if (!err.isCanceled) {
          console.log(`SummaryPanelNamespaceBox: Error fetching validation status: ${API.getErrorString(err)}`);
        }
      });
  };
}

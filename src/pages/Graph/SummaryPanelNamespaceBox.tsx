import * as React from 'react';
import { Tab, Tooltip, TooltipPosition, Badge } from '@patternfly/react-core';
import { style } from 'typestyle';
import { RateTableGrpc, RateTableHttp } from '../../components/SummaryPanel/RateTable';
import { RpsChart, TcpChart } from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType, NodeType } from '../../types/Graph';
import { getAccumulatedTrafficRateGrpc, getAccumulatedTrafficRateHttp } from '../../utils/TrafficRate';
import * as API from '../../services/Api';
import {
  shouldRefreshData,
  getFirstDatapoints,
  mergeMetricsResponses,
  summaryFont,
  summaryHeader,
  summaryBodyTabs,
  hr
} from './SummaryPanelCommon';
import { Response } from '../../services/Api';
import { IstioMetricsMap, Datapoint } from '../../types/Metrics';
import { IstioMetricsOptions } from '../../types/MetricsOptions';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import { CyNode } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { KialiIcon } from 'config/KialiIcon';
import SimpleTabs from 'components/Tab/SimpleTabs';
import { ValidationStatus } from 'types/IstioObjects';
import { PfColors } from '../../components/Pf/PfColors';
import ValidationSummary from 'components/Validations/ValidationSummary';

type SummaryPanelNamespaceBoxMetricsState = {
  errRates: Datapoint[];
  metricsLoadError: string | null;
  reqRates: Datapoint[];
  tcpSent: Datapoint[];
  tcpReceived: Datapoint[];
};

type SummaryPanelNamespaceBoxState = SummaryPanelNamespaceBoxMetricsState & {
  namespaceBox: any;
  loading: boolean;
  validation: ValidationStatus | undefined;
};

const defaultMetricsState: SummaryPanelNamespaceBoxMetricsState = {
  reqRates: [],
  errRates: [],
  tcpSent: [],
  tcpReceived: [],
  metricsLoadError: null
};

const defaultState: SummaryPanelNamespaceBoxState = {
  namespaceBox: null,
  loading: false,
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
    minWidth: '25em',
    overflowY: 'auto' as 'auto',
    backgroundColor: PfColors.White,
    width: '25em'
  };

  private metricsPromise?: CancelablePromise<Response<IstioMetricsMap>>;
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
    this.updateRpsChart();
    this.updateValidation();
  }

  componentDidUpdate(prevProps: SummaryPanelPropType) {
    if (shouldRefreshData(prevProps, this.props)) {
      this.updateRpsChart();
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
    const cluster = namespaceBox.data(CyNode.cluster);

    const numSvc = boxed.filter(`node[nodeType = "${NodeType.SERVICE}"]`).size();
    const numWorkloads = boxed.filter(`node[nodeType = "${NodeType.WORKLOAD}"]`).size();
    const { numApps, numVersions } = this.countApps(boxed);
    const numEdges = boxed.connectedEdges().size();
    // incoming edges are from a different namespace or a different cluster, or from a local root node
    let incomingEdges = namespaceBox
      .cy()
      .nodes(`[${CyNode.namespace} != "${namespace}"],[${CyNode.cluster} != "${cluster}"]`)
      .edgesTo(boxed);
    incomingEdges = incomingEdges.add(boxed.filter(`[?${CyNode.isRoot}]`).edgesTo('*'));
    // outgoing edges are to a different namespace or a different cluster
    const outgoingEdges = boxed.edgesTo(`[${CyNode.namespace} != "${namespace}"],[${CyNode.cluster} != "${cluster}"]`);
    // total edges are incoming + edges from boxed workload/app/root nodes (i.e. not injected service nodes or box nodes)
    const totalEdges = incomingEdges.add(boxed.filter(`[?${CyNode.workload}]`).edgesTo('*'));
    const totalRateGrpc = getAccumulatedTrafficRateGrpc(totalEdges);
    const totalRateHttp = getAccumulatedTrafficRateHttp(totalEdges);
    const incomingRateGrpc = getAccumulatedTrafficRateGrpc(incomingEdges);
    const incomingRateHttp = getAccumulatedTrafficRateHttp(incomingEdges);
    const outgoingRateGrpc = getAccumulatedTrafficRateGrpc(outgoingEdges);
    const outgoingRateHttp = getAccumulatedTrafficRateHttp(outgoingEdges);

    return (
      <div className="panel panel-default" style={SummaryPanelNamespaceBox.panelStyle}>
        <div className="panel-heading" style={summaryHeader}>
          {this.renderNamespace(namespace)}
          <br />
          {this.renderTopologySummary(numSvc, numWorkloads, numApps, numVersions, numEdges)}
        </div>
        <div className={summaryBodyTabs}>
          <SimpleTabs id="graph_summary_tabs" defaultTab={0} style={{ paddingBottom: '10px' }}>
            <Tab style={summaryFont} title="Incoming" eventKey={0}>
              <div style={summaryFont}>
                {incomingRateGrpc.rate === 0 && incomingRateHttp.rate === 0 && (
                  <>
                    <KialiIcon.Info /> No incoming traffic.
                  </>
                )}
                {incomingRateGrpc.rate > 0 && (
                  <RateTableGrpc
                    title="GRPC Traffic (requests per second):"
                    rate={incomingRateGrpc.rate}
                    rateGrpcErr={incomingRateGrpc.rateGrpcErr}
                    rateNR={incomingRateGrpc.rateNoResponse}
                  />
                )}
                {incomingRateHttp.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={incomingRateHttp.rate}
                    rate3xx={incomingRateHttp.rate3xx}
                    rate4xx={incomingRateHttp.rate4xx}
                    rate5xx={incomingRateHttp.rate5xx}
                    rateNR={incomingRateHttp.rateNoResponse}
                  />
                )}
                {
                  // We don't show a sparkline here because we need to aggregate the traffic of an
                  // ad hoc set of [root] nodes. We don't have backend support for that aggregation.
                }
              </div>
            </Tab>
            <Tab style={summaryFont} title="Outgoing" eventKey={1}>
              <div style={summaryFont}>
                {outgoingRateGrpc.rate === 0 && outgoingRateHttp.rate === 0 && (
                  <>
                    <KialiIcon.Info /> No outgoing traffic.
                  </>
                )}
                {outgoingRateGrpc.rate > 0 && (
                  <RateTableGrpc
                    title="GRPC Traffic (requests per second):"
                    rate={outgoingRateGrpc.rate}
                    rateGrpcErr={outgoingRateGrpc.rateGrpcErr}
                    rateNR={outgoingRateGrpc.rateNoResponse}
                  />
                )}
                {outgoingRateHttp.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={outgoingRateHttp.rate}
                    rate3xx={outgoingRateHttp.rate3xx}
                    rate4xx={outgoingRateHttp.rate4xx}
                    rate5xx={outgoingRateHttp.rate5xx}
                    rateNR={outgoingRateHttp.rateNoResponse}
                  />
                )}
                {
                  // We don't show a sparkline here because we need to aggregate the traffic of an
                  // ad hoc set of [root] nodes. We don't have backend support for that aggregation.
                }
              </div>
            </Tab>
            <Tab style={summaryFont} title="Total" eventKey={2}>
              <div style={summaryFont}>
                {totalRateGrpc.rate === 0 && totalRateHttp.rate === 0 && (
                  <>
                    <KialiIcon.Info /> No traffic.
                  </>
                )}
                {totalRateGrpc.rate > 0 && (
                  <RateTableGrpc
                    title="GRPC Traffic (requests per second):"
                    rate={totalRateGrpc.rate}
                    rateGrpcErr={totalRateGrpc.rateGrpcErr}
                    rateNR={totalRateGrpc.rateNoResponse}
                  />
                )}
                {totalRateHttp.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={totalRateHttp.rate}
                    rate3xx={totalRateHttp.rate3xx}
                    rate4xx={totalRateHttp.rate4xx}
                    rate5xx={totalRateHttp.rate5xx}
                    rateNR={totalRateHttp.rateNoResponse}
                  />
                )}
                <div>
                  {hr()}
                  {this.renderRpsChart()}
                </div>
              </div>
            </Tab>
          </SimpleTabs>
        </div>
      </div>
    );
  }

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
          <Tooltip position={TooltipPosition.auto} content={<>Namespace</>}>
            <Badge className="virtualitem_badge_definition" style={{ marginBottom: '2px' }}>
              NS
            </Badge>
          </Tooltip>
          {ns}{' '}
          {!!validation && (
            <ValidationSummary
              id={'ns-val-' + ns}
              errors={validation.errors}
              warnings={validation.warnings}
              objectCount={validation.objectCount}
              style={{ marginLeft: '5px' }}
            />
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

  private renderRpsChart = () => {
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

    return (
      <>
        <RpsChart label="HTTP - Total Request Traffic" dataRps={this.state.reqRates} dataErrors={this.state.errRates} />
        <TcpChart label="TCP - Total Traffic" receivedRates={this.state.tcpReceived} sentRates={this.state.tcpSent} />
      </>
    );
  };

  private updateRpsChart = () => {
    const props: SummaryPanelPropType = this.props;
    const namespace = props.data.summaryTarget.data(CyNode.namespace);
    const options: IstioMetricsOptions = {
      filters: ['request_count', 'request_error_count'],
      queryTime: props.queryTime,
      duration: props.duration,
      step: props.step,
      rateInterval: props.rateInterval,
      direction: 'inbound',
      reporter: 'destination'
    };
    const promiseHTTP = API.getNamespaceMetrics(namespace, options);
    // TCP metrics are only available for reporter="source"
    const optionsTCP: IstioMetricsOptions = {
      filters: ['tcp_sent', 'tcp_received'],
      queryTime: props.queryTime,
      duration: props.duration,
      step: props.step,
      rateInterval: props.rateInterval,
      direction: 'inbound',
      reporter: 'source'
    };
    const promiseTCP = API.getNamespaceMetrics(namespace, optionsTCP);
    this.metricsPromise = makeCancelablePromise(mergeMetricsResponses([promiseHTTP, promiseTCP]));

    this.metricsPromise.promise
      .then(response => {
        this.setState({
          loading: false,
          reqRates: getFirstDatapoints(response.data.request_count),
          errRates: getFirstDatapoints(response.data.request_error_count),
          tcpSent: getFirstDatapoints(response.data.tcp_sent),
          tcpReceived: getFirstDatapoints(response.data.tcp_received)
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

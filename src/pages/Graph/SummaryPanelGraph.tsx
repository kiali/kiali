import * as React from 'react';
import { Tab, Tooltip, TooltipPosition, Badge } from '@patternfly/react-core';
import { style } from 'typestyle';
import _ from 'lodash';
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
import { Metrics, Datapoint } from '../../types/Metrics';
import { IstioMetricsOptions } from '../../types/MetricsOptions';
import { CancelablePromise, makeCancelablePromise, PromisesRegistry } from '../../utils/CancelablePromises';
import { CyNode } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { KialiIcon } from 'config/KialiIcon';
import SimpleTabs from 'components/Tab/SimpleTabs';
import { ValidationStatus } from 'types/IstioObjects';
import Namespace from 'types/Namespace';
import ValidationSummary from 'components/Validations/ValidationSummary';

type SummaryPanelGraphMetricsState = {
  reqRates: Datapoint[];
  errRates: Datapoint[];
  tcpSent: Datapoint[];
  tcpReceived: Datapoint[];
  metricsLoadError: string | null;
};

// TODO replace with real type
type ValidationsMap = Map<string, ValidationStatus>;

type SummaryPanelGraphState = SummaryPanelGraphMetricsState & {
  isOpen: boolean;
  graph: any;
  loading: boolean;
  validationsLoading: boolean;
  validationsMap: ValidationsMap;
};

const defaultMetricsState: SummaryPanelGraphMetricsState = {
  reqRates: [],
  errRates: [],
  tcpSent: [],
  tcpReceived: [],
  metricsLoadError: null
};

const defaultState: SummaryPanelGraphState = {
  isOpen: false,
  graph: null,
  loading: false,
  validationsLoading: false,
  validationsMap: new Map<string, ValidationStatus>(),
  ...defaultMetricsState
};

const topologyStyle = style({
  margin: '0 1em'
});

export default class SummaryPanelGraph extends React.Component<SummaryPanelPropType, SummaryPanelGraphState> {
  static readonly panelStyle = {
    height: '100%',
    margin: 0,
    minWidth: '25em',
    overflowY: 'auto' as 'auto',
    width: '25em'
  };

  private metricsPromise?: CancelablePromise<Response<Metrics>>;
  private validationSummaryPromises: PromisesRegistry = new PromisesRegistry();

  constructor(props: SummaryPanelPropType) {
    super(props);

    this.state = { ...defaultState };
  }

  static getDerivedStateFromProps(props: SummaryPanelPropType, state: SummaryPanelGraphState) {
    // if the summaryTarget (i.e. graph) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.data.summaryTarget !== state.graph
      ? { graph: props.data.summaryTarget, loading: true, ...defaultMetricsState }
      : null;
  }

  componentDidMount() {
    if (this.shouldShowRPSChart()) {
      this.updateRpsChart();
    }
    this.updateValidations();
  }

  componentDidUpdate(prevProps: SummaryPanelPropType) {
    if (shouldRefreshData(prevProps, this.props)) {
      if (this.shouldShowRPSChart()) {
        this.updateRpsChart();
      }
      this.updateValidations();
    }
  }

  componentWillUnmount() {
    if (this.metricsPromise) {
      this.metricsPromise.cancel();
    }
  }

  render() {
    const cy = this.props.data.summaryTarget;
    if (!cy) {
      return null;
    }

    const numSvc = cy.$(`node[nodeType = "${NodeType.SERVICE}"]`).size();
    const numWorkloads = cy.$(`node[nodeType = "${NodeType.WORKLOAD}"]`).size();
    const { numApps, numVersions } = this.countApps(cy);
    const numEdges = cy.edges().size();
    // when getting accumulated traffic rates don't count requests from injected service nodes
    const nonServiceEdges = cy.$(`node[nodeType != "${NodeType.SERVICE}"][!isGroup]`).edgesTo('*');
    const totalRateGrpc = getAccumulatedTrafficRateGrpc(nonServiceEdges);
    const totalRateHttp = getAccumulatedTrafficRateHttp(nonServiceEdges);
    const incomingEdges = cy.$(`node[?${CyNode.isRoot}]`).edgesTo('*');
    const incomingRateGrpc = getAccumulatedTrafficRateGrpc(incomingEdges);
    const incomingRateHttp = getAccumulatedTrafficRateHttp(incomingEdges);
    const outgoingEdges = cy
      .nodes()
      .leaves(`node[?${CyNode.isOutside}],[?${CyNode.isServiceEntry}]`)
      .connectedEdges();
    const outgoingRateGrpc = getAccumulatedTrafficRateGrpc(outgoingEdges);
    const outgoingRateHttp = getAccumulatedTrafficRateHttp(outgoingEdges);

    return (
      <div className="panel panel-default" style={SummaryPanelGraph.panelStyle}>
        <div className="panel-heading" style={summaryHeader}>
          {this.renderNamespacesSummary()}
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
                    rateErr={incomingRateGrpc.rateErr}
                  />
                )}
                {incomingRateHttp.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={incomingRateHttp.rate}
                    rate3xx={incomingRateHttp.rate3xx}
                    rate4xx={incomingRateHttp.rate4xx}
                    rate5xx={incomingRateHttp.rate5xx}
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
                    rateErr={outgoingRateGrpc.rateErr}
                  />
                )}
                {outgoingRateHttp.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={outgoingRateHttp.rate}
                    rate3xx={outgoingRateHttp.rate3xx}
                    rate4xx={outgoingRateHttp.rate4xx}
                    rate5xx={outgoingRateHttp.rate5xx}
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
                    rateErr={totalRateGrpc.rateErr}
                  />
                )}
                {totalRateHttp.rate > 0 && (
                  <RateTableHttp
                    title="HTTP (requests per second):"
                    rate={totalRateHttp.rate}
                    rate3xx={totalRateHttp.rate3xx}
                    rate4xx={totalRateHttp.rate4xx}
                    rate5xx={totalRateHttp.rate5xx}
                  />
                )}
                {this.shouldShowRPSChart() && (
                  <div>
                    {hr()}
                    {this.renderRpsChart()}
                  </div>
                )}
              </div>
            </Tab>
          </SimpleTabs>
        </div>
      </div>
    );
  }

  private countApps = (cy): { numApps: number; numVersions: number } => {
    const appVersions: { [key: string]: Set<string> } = {};

    cy.$(`node[nodeType = "${NodeType.APP}"][!isGroup]`).forEach(node => {
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

  private renderNamespacesSummary = () => {
    return <>{this.props.namespaces.map(namespace => this.renderNamespace(namespace.name))}</>;
  };

  private renderNamespace = (ns: string) => {
    const validation = this.state.validationsMap[ns];
    return (
      <>
        <span>
          <Tooltip position={TooltipPosition.top} content={<>Namespace</>}>
            <Badge className="virtualitem_badge_definition" style={{ marginBottom: '2px' }}>
              NS
            </Badge>
          </Tooltip>
          {ns}
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
      </>
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
      <br />
      <strong>Current Graph:</strong>
      <br />
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

  private shouldShowRPSChart() {
    // TODO we omit the rps chart when dealing with multiple namespaces. There is no backend
    // API support to gather the data. The whole-graph chart is of nominal value, it will likely be OK.
    return this.props.namespaces.length === 1;
  }

  private updateRpsChart = () => {
    const props: SummaryPanelPropType = this.props;
    const options: IstioMetricsOptions = {
      filters: ['request_count', 'request_error_count'],
      queryTime: props.queryTime,
      duration: props.duration,
      step: props.step,
      rateInterval: props.rateInterval,
      direction: 'inbound',
      reporter: 'destination'
    };
    const promiseHTTP = API.getNamespaceMetrics(props.namespaces[0].name, options);
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
    const promiseTCP = API.getNamespaceMetrics(props.namespaces[0].name, optionsTCP);
    this.metricsPromise = makeCancelablePromise(mergeMetricsResponses([promiseHTTP, promiseTCP]));

    this.metricsPromise.promise
      .then(response => {
        this.setState({
          loading: false,
          reqRates: getFirstDatapoints(response.data.metrics.request_count),
          errRates: getFirstDatapoints(response.data.metrics.request_error_count),
          tcpSent: getFirstDatapoints(response.data.metrics.tcp_sent),
          tcpReceived: getFirstDatapoints(response.data.metrics.tcp_received)
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

  private updateValidations = () => {
    const newValidationsMap = new Map<string, ValidationStatus>();
    _.chunk(this.props.namespaces, 10).forEach(chunk => {
      this.validationSummaryPromises
        .registerChained('validationSummaryChunks', undefined, () =>
          this.fetchValidationsChunk(chunk, newValidationsMap)
        )
        .then(() => {
          this.setState({ validationsMap: newValidationsMap });
        });
    });
  };

  fetchValidationsChunk(chunk: Namespace[], validationsMap: ValidationsMap) {
    return Promise.all(
      chunk.map(ns => {
        return API.getNamespaceValidations(ns.name).then(rs => ({ validation: rs.data, ns: ns }));
      })
    )
      .then(results => {
        results.forEach(result => {
          validationsMap[result.ns.name] = result.validation;
        });
      })
      .catch(err => {
        if (!err.isCanceled) {
          console.log(`SummaryPanelGraph: Error fetching validation status: ${API.getErrorString(err)}`);
        }
      });
  }
}

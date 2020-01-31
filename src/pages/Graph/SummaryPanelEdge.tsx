import * as React from 'react';
import { RateTableGrpc, RateTableHttp } from '../../components/SummaryPanel/RateTable';
import { RpsChart, TcpChart } from '../../components/SummaryPanel/RpsChart';
import { ResponseTimeChart, ResponseTimeUnit } from '../../components/SummaryPanel/ResponseTimeChart';
import {
  GraphType,
  NodeType,
  Protocol,
  SummaryPanelPropType,
  DecoratedGraphNodeData,
  UNKNOWN
} from '../../types/Graph';
import { renderBadgedLink } from './SummaryLink';
import {
  shouldRefreshData,
  getDatapoints,
  getNodeMetrics,
  getNodeMetricType,
  hr,
  renderNoTraffic,
  NodeMetricType,
  summaryHeader,
  summaryBodyTabs,
  summaryPanel,
  summaryFont
} from './SummaryPanelCommon';
import { MetricGroup, Metric, Metrics, Datapoint } from '../../types/Metrics';
import { Response } from '../../services/Api';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import { decoratedEdgeData, decoratedNodeData } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { ResponseFlagsTable } from 'components/SummaryPanel/ResponseFlagsTable';
import { ResponseHostsTable } from 'components/SummaryPanel/ResponseHostsTable';
import { KialiIcon } from 'config/KialiIcon';
import { Tab } from '@patternfly/react-core';
import SimpleTabs from 'components/Tab/SimpleTabs';

type SummaryPanelEdgeMetricsState = {
  reqRates: Datapoint[];
  errRates: Datapoint[];
  rtAvg: Datapoint[];
  rtMed: Datapoint[];
  rt95: Datapoint[];
  rt99: Datapoint[];
  tcpSent: Datapoint[];
  tcpReceived: Datapoint[];
  unit: ResponseTimeUnit;
};

type SummaryPanelEdgeState = SummaryPanelEdgeMetricsState & {
  edge: any;
  loading: boolean;
  metricsLoadError: string | null;
};

const defaultMetricsState: SummaryPanelEdgeMetricsState = {
  reqRates: [],
  errRates: [],
  rtAvg: [],
  rtMed: [],
  rt95: [],
  rt99: [],
  tcpSent: [],
  tcpReceived: [],
  unit: 'ms'
};

const defaultState: SummaryPanelEdgeState = {
  edge: null,
  loading: false,
  metricsLoadError: null,
  ...defaultMetricsState
};

export default class SummaryPanelEdge extends React.Component<SummaryPanelPropType, SummaryPanelEdgeState> {
  private metricsPromise?: CancelablePromise<Response<Metrics>>;
  private readonly mainDivRef: React.RefObject<HTMLDivElement>;

  constructor(props: SummaryPanelPropType) {
    super(props);

    this.state = { ...defaultState };
    this.mainDivRef = React.createRef<HTMLDivElement>();
  }

  static getDerivedStateFromProps(props: SummaryPanelPropType, state: SummaryPanelEdgeState) {
    // if the summaryTarget (i.e. selected edge) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.data.summaryTarget !== state.edge
      ? { edge: props.data.summaryTarget, loading: true, ...defaultMetricsState }
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
    const target = this.props.data.summaryTarget;
    const source = decoratedNodeData(target.source());
    const dest = decoratedNodeData(target.target());
    const edge = decoratedEdgeData(target);
    const mTLSPercentage = edge.isMTLS;
    const isMtls = mTLSPercentage && mTLSPercentage > 0;
    const protocol = edge.protocol;
    const isGrpc = protocol === Protocol.GRPC;
    const isHttp = protocol === Protocol.HTTP;
    const isTcp = protocol === Protocol.TCP;

    const MTLSBlock = () => {
      return (
        <div className="panel-heading" style={summaryHeader}>
          {this.renderBadgeSummary(mTLSPercentage)}
        </div>
      );
    };

    return (
      <div ref={this.mainDivRef} className={`panel panel-default ${summaryPanel}`}>
        <div className="panel-heading" style={summaryHeader}>
          {renderBadgedLink(source, undefined, 'From:  ')}
          {renderBadgedLink(dest, undefined, 'To:        ')}
        </div>
        {isMtls && <MTLSBlock />}
        {(isGrpc || isHttp) && (
          <div className={summaryBodyTabs}>
            <SimpleTabs id="edge_summary_rate_tabs" defaultTab={0} style={{ paddingBottom: '10px' }}>
              <Tab style={summaryFont} title="Traffic" eventKey={0}>
                <div style={summaryFont}>
                  {isGrpc && (
                    <>
                      <RateTableGrpc
                        title="GRPC requests per second:"
                        rate={this.safeRate(edge.grpc)}
                        rateErr={this.safeRate(edge.grpcPercentErr)}
                      />
                    </>
                  )}
                  {isHttp && (
                    <>
                      <RateTableHttp
                        title="HTTP requests per second:"
                        rate={this.safeRate(edge.http)}
                        rate3xx={this.safeRate(edge.http3xx)}
                        rate4xx={this.safeRate(edge.http4xx)}
                        rate5xx={this.safeRate(edge.http5xx)}
                      />
                    </>
                  )}
                </div>
              </Tab>
              <Tab style={summaryFont} title="Flags" eventKey={1}>
                <div style={summaryFont}>
                  <ResponseFlagsTable
                    title={'Response flags by ' + (isGrpc ? 'GRPC code:' : 'HTTP code:')}
                    responses={edge.responses}
                  />
                </div>
              </Tab>
              <Tab style={summaryFont} title="Hosts" eventKey={2}>
                <div style={summaryFont}>
                  <ResponseHostsTable
                    title={'Hosts by ' + (isGrpc ? 'GRPC code:' : 'HTTP code:')}
                    responses={edge.responses}
                  />
                </div>
              </Tab>
            </SimpleTabs>
            {hr()}
            {this.renderCharts(target, isGrpc, isHttp, isTcp)}
          </div>
        )}
        {isTcp && (
          <div className={summaryBodyTabs}>
            <SimpleTabs id="edge_summary_flag_hosts_tabs" defaultTab={0} style={{ paddingBottom: '10px' }}>
              <Tab style={summaryFont} eventKey={0} title="Flags">
                <div style={summaryFont}>
                  <ResponseFlagsTable title="Response flags by code:" responses={edge.responses} />
                </div>
              </Tab>
              <Tab style={summaryFont} eventKey={1} title="Hosts">
                <div style={summaryFont}>
                  <ResponseHostsTable title="Hosts by code:" responses={edge.responses} />
                </div>
              </Tab>
            </SimpleTabs>
            {hr()}
            {this.renderCharts(target, isGrpc, isHttp, isTcp)}
          </div>
        )}
        {!isGrpc && !isHttp && !isTcp && <div className="panel-body">{renderNoTraffic()}</div>}
      </div>
    );
  }

  private getByLabels = (sourceMetricType: NodeMetricType, destMetricType: NodeMetricType) => {
    let sourceLabel: string;
    switch (sourceMetricType) {
      case NodeMetricType.APP:
        sourceLabel = 'source_app';
        break;
      case NodeMetricType.SERVICE:
        sourceLabel = 'destination_service_name';
        break;
      case NodeMetricType.WORKLOAD:
      // fall through, workload is default
      default:
        sourceLabel = 'source_workload';
        break;
    }
    // For special service dest nodes we want to narrow the data to only TS with 'unknown' workloads (see the related
    // comparator in getNodeDatapoints).
    return this.isSpecialServiceDest(destMetricType) ? [sourceLabel, 'destination_workload'] : [sourceLabel];
  };

  private getNodeDataPoints = (
    m: MetricGroup,
    sourceMetricType: NodeMetricType,
    destMetricType: NodeMetricType,
    data: DecoratedGraphNodeData
  ) => {
    let sourceLabel: string;
    let sourceValue: string | undefined;
    switch (sourceMetricType) {
      case NodeMetricType.APP:
        sourceLabel = 'source_app';
        sourceValue = data.app;
        break;
      case NodeMetricType.SERVICE:
        sourceLabel = 'destination_service_name';
        sourceValue = data.service;
        break;
      case NodeMetricType.WORKLOAD:
      // fall through, use workload as the default
      default:
        sourceLabel = 'source_workload';
        sourceValue = data.workload;
    }
    const comparator = (metric: Metric) => {
      if (this.isSpecialServiceDest(destMetricType)) {
        return metric[sourceLabel] === sourceValue && metric.destination_workload === UNKNOWN;
      }
      return metric[sourceLabel] === sourceValue;
    };
    return getDatapoints(m, comparator);
  };

  private updateCharts = (props: SummaryPanelPropType) => {
    const edge = props.data.summaryTarget;
    const edgeData = decoratedEdgeData(edge);
    const sourceData = decoratedNodeData(edge.source());
    const destData = decoratedNodeData(edge.target());
    const sourceMetricType = getNodeMetricType(sourceData);
    const destMetricType = getNodeMetricType(destData);
    const protocol = edgeData.protocol;
    const isGrpc = protocol === Protocol.GRPC;
    const isHttp = protocol === Protocol.HTTP;
    const isTcp = protocol === Protocol.TCP;

    if (this.metricsPromise) {
      this.metricsPromise.cancel();
      this.metricsPromise = undefined;
    }

    // Just return if the metric types are unset, there is no data, destination node is "unknown" or charts are unsupported
    if (
      !destMetricType ||
      !sourceMetricType ||
      !this.hasSupportedCharts(edge) ||
      (!isGrpc && !isHttp && !isTcp) ||
      destData.isInaccessible
    ) {
      this.setState({
        loading: false
      });
      return;
    }

    const quantiles = ['0.5', '0.95', '0.99'];
    const byLabels = this.getByLabels(sourceMetricType, destMetricType);

    let promiseRps, promiseTcp;
    if (isGrpc || isHttp) {
      const reporterRps =
        sourceData.nodeType === NodeType.UNKNOWN ||
        sourceData.nodeType === NodeType.SERVICE ||
        edge.source().isIstio ||
        edge.target().isIstio
          ? 'destination'
          : 'source';
      // see comment below about why we have both 'request_duration' and 'request_duration_millis'
      const filtersRps = ['request_count', 'request_duration', 'request_duration_millis', 'request_error_count'];
      promiseRps = getNodeMetrics(
        destMetricType,
        edge.target(),
        props,
        filtersRps,
        'inbound',
        reporterRps,
        protocol,
        quantiles,
        byLabels
      );
    } else {
      // TCP uses slightly different reporting
      const reporterTCP = sourceData.nodeType === NodeType.UNKNOWN || sourceData.isIstio ? 'destination' : 'source';
      const filtersTCP = ['tcp_sent', 'tcp_received'];
      promiseTcp = getNodeMetrics(
        destMetricType,
        edge.target(),
        props,
        filtersTCP,
        'inbound',
        reporterTCP,
        undefined, // tcp metrics use dedicated metrics (i.e. no request_protocol label)
        quantiles,
        byLabels
      );
    }
    this.metricsPromise = makeCancelablePromise(promiseRps ? promiseRps : promiseTcp);
    this.metricsPromise.promise
      .then(response => {
        const metrics = response.data.metrics;
        const histograms = response.data.histograms;
        let { reqRates, errRates, rtAvg, rtMed, rt95, rt99, tcpSent, tcpReceived, unit } = defaultMetricsState;
        if (isGrpc || isHttp) {
          reqRates = this.getNodeDataPoints(metrics.request_count, sourceMetricType, destMetricType, sourceData);
          errRates = this.getNodeDataPoints(metrics.request_error_count, sourceMetricType, destMetricType, sourceData);
          // We query for both 'request_duration' and 'request_duration_millis' because the former is used
          // with Istio mixer telemetry and the latter with Istio mixer-less (introduced as an experimental
          // option in istion 1.3.0).  Until we can safely rely on the newer metric we must support both. So,
          // prefer the newer but if it holds no valid data, revert to the older.
          let histo = histograms.request_duration_millis;
          rtAvg = this.getNodeDataPoints(histo.avg, sourceMetricType, destMetricType, sourceData);
          if (this.isEmpty(rtAvg)) {
            histo = histograms.request_duration;
            unit = 's';
            rtAvg = this.getNodeDataPoints(histo.avg, sourceMetricType, destMetricType, sourceData);
          }
          rtMed = this.getNodeDataPoints(histo['0.5'], sourceMetricType, destMetricType, sourceData);
          rt95 = this.getNodeDataPoints(histo['0.95'], sourceMetricType, destMetricType, sourceData);
          rt99 = this.getNodeDataPoints(histo['0.99'], sourceMetricType, destMetricType, sourceData);
        } else {
          // TCP
          tcpSent = this.getNodeDataPoints(metrics.tcp_sent, sourceMetricType, destMetricType, sourceData);
          tcpReceived = this.getNodeDataPoints(metrics.tcp_received, sourceMetricType, destMetricType, sourceData);
        }

        this.setState({
          loading: false,
          reqRates: reqRates,
          errRates: errRates,
          rtAvg: rtAvg,
          rtMed: rtMed,
          rt95: rt95,
          rt99: rt99,
          tcpSent: tcpSent,
          tcpReceived: tcpReceived,
          unit: unit
        });
      })
      .catch(error => {
        if (error.isCanceled) {
          console.debug('SummaryPanelEdge: Ignore fetch error (canceled).');
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

  // Returns true if the histo datum values are all NaN
  private isEmpty(dps: Datapoint[]): boolean {
    for (const dp of dps) {
      if (!isNaN(dp[1])) {
        return false;
      }
    }
    return true;
  }

  private safeRate = (s: any) => {
    return isNaN(s) ? 0.0 : Number(s);
  };

  private renderCharts = (edge, isGrpc, isHttp, isTcp) => {
    if (!this.hasSupportedCharts(edge)) {
      return isGrpc || isHttp ? (
        <>
          <KialiIcon.Info /> Service graphs do not support service-to-service aggregate sparklines. See the chart above
          for aggregate traffic or use the workload graph type to observe individual workload-to-service edge
          sparklines.
        </>
      ) : (
        <>
          <KialiIcon.Info /> Service graphs do not support service-to-service aggregate sparklines. Use the workload
          graph type to observe individual workload-to-service edge sparklines.
        </>
      );
    }

    const source = decoratedNodeData(edge.source());
    const target = decoratedNodeData(edge.target());
    if (target.isInaccessible) {
      return (
        <>
          <KialiIcon.Info /> Sparkline charts cannot be shown because the destination is inaccessible.
        </>
      );
    }
    if (source.isServiceEntry || target.isServiceEntry) {
      return (
        <>
          <KialiIcon.Info /> Sparkline charts cannot be shown because the source or destination is a serviceEntry.
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

    let rpsChart, tcpChart;
    if (isGrpc || isHttp) {
      const labelRps = isGrpc ? 'GRPC Request Traffic' : 'HTTP Request Traffic';
      const labelRt = isGrpc ? 'GRPC Request Response Time (ms)' : 'HTTP Request Response Time (ms)';
      rpsChart = (
        <>
          <RpsChart label={labelRps} dataRps={this.state.reqRates!} dataErrors={this.state.errRates} />
          {hr()}
          <ResponseTimeChart
            label={labelRt}
            rtAvg={this.state.rtAvg}
            rtMed={this.state.rtMed}
            rt95={this.state.rt95}
            rt99={this.state.rt99}
            unit={this.state.unit}
          />
        </>
      );
    } else if (isTcp) {
      tcpChart = <TcpChart label="TCP Traffic" sentRates={this.state.tcpSent} receivedRates={this.state.tcpReceived} />;
    }

    return (
      <>
        {rpsChart}
        {tcpChart}
      </>
    );
  };

  private hasSupportedCharts = edge => {
    const sourceData = decoratedNodeData(edge.source());
    const destData = decoratedNodeData(edge.target());
    const sourceMetricType = getNodeMetricType(sourceData);
    const destMetricType = getNodeMetricType(destData);

    // service-to-service edges are unsupported because they represent aggregations (of multiple workload to service edges)
    const chartsSupported = sourceMetricType !== NodeMetricType.SERVICE || destMetricType !== NodeMetricType.SERVICE;
    return chartsSupported;
  };

  // We need to handle the special case of a dest service node showing client failures. These service nodes show up in
  // non-service graphs, even when not injecting service nodes.
  private isSpecialServiceDest(destMetricType: NodeMetricType) {
    return (
      destMetricType === NodeMetricType.SERVICE &&
      !this.props.injectServiceNodes &&
      this.props.graphType !== GraphType.SERVICE
    );
  }

  private renderBadgeSummary = (mTLSPercentage: number) => {
    let mtls = 'mTLS Enabled';
    const isMtls = mTLSPercentage > 0;
    if (isMtls && mTLSPercentage < 100.0) {
      mtls = `${mtls} [${mTLSPercentage}% of request traffic]`;
    }
    return (
      <>
        {isMtls && (
          <div>
            <KialiIcon.MtlsLock />
            <span style={{ paddingLeft: '6px' }}>{mtls}</span>
          </div>
        )}
      </>
    );
  };
}

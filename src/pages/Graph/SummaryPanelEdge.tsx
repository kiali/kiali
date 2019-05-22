import * as React from 'react';
import { Icon, Nav, NavItem, TabContainer, TabContent, TabPane } from 'patternfly-react';
import { RateTableGrpc, RateTableHttp } from '../../components/SummaryPanel/RateTable';
import { RpsChart, TcpChart } from '../../components/SummaryPanel/RpsChart';
import ResponseTimeChart from '../../components/SummaryPanel/ResponseTimeChart';
import { GraphType, NodeType, Protocol, SummaryPanelPropType } from '../../types/Graph';
import { renderTitle } from './SummaryLink';
import {
  shouldRefreshData,
  nodeData,
  getDatapoints,
  getNodeMetrics,
  getNodeMetricType,
  renderNoTraffic,
  NodeData,
  NodeMetricType,
  renderLabels
} from './SummaryPanelCommon';
import { MetricGroup, Metric, Metrics } from '../../types/Metrics';
import { Response } from '../../services/Api';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import { serverConfig } from '../../config/ServerConfig';
import { CyEdge } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { icons } from '../../config';
import { ResponseTable } from '../../components/SummaryPanel/ResponseTable';

type SummaryPanelEdgeState = {
  loading: boolean;
  reqRates: [string | number][] | null;
  errRates: [string | number][];
  rtAvg: [string | number][];
  rtMed: [string | number][];
  rt95: [string | number][];
  rt99: [string | number][];
  tcpSent: [string | number][];
  tcpReceived: [string | number][];
  metricsLoadError: string | null;
};

const defaultSummaryPanelState: SummaryPanelEdgeState = {
  loading: true,
  reqRates: null,
  errRates: [],
  rtAvg: [],
  rtMed: [],
  rt95: [],
  rt99: [],
  tcpSent: [],
  tcpReceived: [],
  metricsLoadError: null
};

export default class SummaryPanelEdge extends React.Component<SummaryPanelPropType, SummaryPanelEdgeState> {
  static readonly panelStyle = {
    height: '100%',
    margin: 0,
    minWidth: '25em',
    overflowY: 'auto' as 'auto',
    width: '25em'
  };

  private metricsPromise?: CancelablePromise<Response<Metrics>>;
  private readonly mainDivRef: React.RefObject<HTMLDivElement>;

  constructor(props: SummaryPanelPropType) {
    super(props);

    this.state = { ...defaultSummaryPanelState };
    this.mainDivRef = React.createRef<HTMLDivElement>();
  }

  componentDidMount() {
    this.updateCharts(this.props);
  }

  componentDidUpdate(prevProps: SummaryPanelPropType) {
    if (prevProps.data.summaryTarget !== this.props.data.summaryTarget) {
      this.setState({
        loading: true,
        reqRates: null
      });
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
    const edge = this.props.data.summaryTarget;
    const source = edge.source();
    const dest = edge.target();
    const mTLSPercentage = edge.data(CyEdge.isMTLS);
    const isMtls = mTLSPercentage && Number(mTLSPercentage) > 0;
    const protocol = edge.data(CyEdge.protocol);
    const isGrpc = protocol === Protocol.GRPC;
    const isHttp = protocol === Protocol.HTTP;
    const isTcp = protocol === Protocol.TCP;

    const HeadingBlock = ({ prefix, node }) => {
      const data = nodeData(node);
      return (
        <div className="panel-heading label-collection">
          <strong>{prefix}</strong> {renderTitle(data)}
          <br />
          {renderLabels(data)}
        </div>
      );
    };

    const MTLSBlock = () => {
      return <div className="panel-heading label-collection">{this.renderBadgeSummary(mTLSPercentage)}</div>;
    };

    return (
      <div ref={this.mainDivRef} className="panel panel-default" style={SummaryPanelEdge.panelStyle}>
        <HeadingBlock prefix="From" node={source} />
        <HeadingBlock prefix="To" node={dest} />
        {isMtls && <MTLSBlock />}
        {(isGrpc || isHttp) && (
          <div
            className="panel-body"
            style={{ padding: '0px', paddingLeft: '15px', paddingRight: '15px', paddingBottom: '15px' }}
          >
            <TabContainer id="basic-tabs" defaultActiveKey="traffic">
              <div>
                <Nav bsClass="nav nav-tabs nav-tabs-pf" style={{ paddingLeft: '20px' }}>
                  <NavItem eventKey="traffic">
                    <div>Traffic</div>
                  </NavItem>
                  <NavItem eventKey="responses">
                    <div>Response Codes</div>
                  </NavItem>
                </Nav>
                <TabContent style={{ paddingTop: '10px' }}>
                  <TabPane eventKey="traffic" mountOnEnter={true} unmountOnExit={true}>
                    {isGrpc && (
                      <>
                        <RateTableGrpc
                          title="GRPC requests per second:"
                          rate={this.safeRate(edge.data(CyEdge.grpc))}
                          rateErr={this.safeRate(edge.data(CyEdge.grpcPercentErr))}
                        />
                      </>
                    )}
                    {isHttp && (
                      <>
                        <RateTableHttp
                          title="HTTP requests per second:"
                          rate={this.safeRate(edge.data(CyEdge.http))}
                          rate3xx={this.safeRate(edge.data(CyEdge.http3xx))}
                          rate4xx={this.safeRate(edge.data(CyEdge.http4xx))}
                          rate5xx={this.safeRate(edge.data(CyEdge.http5xx))}
                        />
                      </>
                    )}
                  </TabPane>
                  <TabPane eventKey="responses" mountOnEnter={true} unmountOnExit={true}>
                    <ResponseTable
                      title={isGrpc ? 'GRPC codes:' : 'HTTP codes:'}
                      responses={edge.data(CyEdge.responses)}
                    />
                  </TabPane>
                </TabContent>
              </div>
            </TabContainer>
            <hr />
            {this.renderCharts(edge, isGrpc, isHttp, isTcp)}
          </div>
        )}
        {isTcp && (
          <div className="panel-body">
            <ResponseTable title="TCP Responses:" responses={edge.data(CyEdge.responses)} />
            <hr />
            {this.renderCharts(edge, isGrpc, isHttp, isTcp)}
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
    title: string,
    sourceMetricType: NodeMetricType,
    destMetricType: NodeMetricType,
    data: NodeData
  ) => {
    let sourceLabel: string;
    let sourceValue: string;
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
        return metric[sourceLabel] === sourceValue && metric.destination_workload === 'unknown';
      }
      return metric[sourceLabel] === sourceValue;
    };
    return getDatapoints(m, title, comparator);
  };

  private updateCharts = (props: SummaryPanelPropType) => {
    const edge = props.data.summaryTarget;
    const sourceData = nodeData(edge.source());
    const destData = nodeData(edge.target());
    const sourceMetricType = getNodeMetricType(sourceData);
    const destMetricType = getNodeMetricType(destData);
    const protocol = edge.data(CyEdge.protocol);
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
        sourceData.namespace === serverConfig.istioNamespace ||
        destData.namespace === serverConfig.istioNamespace
          ? 'destination'
          : 'source';
      const filtersRps = ['request_count', 'request_duration', 'request_error_count'];
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
      const reporterTCP =
        sourceData.nodeType === NodeType.UNKNOWN || sourceData.namespace === serverConfig.istioNamespace
          ? 'destination'
          : 'source';
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
        let { reqRates, errRates, rtAvg, rtMed, rt95, rt99, tcpSent, tcpReceived } = defaultSummaryPanelState;
        if (isGrpc || isHttp) {
          reqRates = this.getNodeDataPoints(metrics.request_count, 'RPS', sourceMetricType, destMetricType, sourceData);
          errRates = this.getNodeDataPoints(
            metrics.request_error_count,
            'Error',
            sourceMetricType,
            destMetricType,
            sourceData
          );
          rtAvg = this.getNodeDataPoints(
            histograms.request_duration.avg,
            'Average',
            sourceMetricType,
            destMetricType,
            sourceData
          );
          rtMed = this.getNodeDataPoints(
            histograms.request_duration['0.5'],
            'Median',
            sourceMetricType,
            destMetricType,
            sourceData
          );
          rt95 = this.getNodeDataPoints(
            histograms.request_duration['0.95'],
            '95th',
            sourceMetricType,
            destMetricType,
            sourceData
          );
          rt99 = this.getNodeDataPoints(
            histograms.request_duration['0.99'],
            '99th',
            sourceMetricType,
            destMetricType,
            sourceData
          );
        } else {
          // TCP
          tcpSent = this.getNodeDataPoints(metrics.tcp_sent, 'Sent', sourceMetricType, destMetricType, sourceData);
          tcpReceived = this.getNodeDataPoints(
            metrics.tcp_received,
            'Received',
            sourceMetricType,
            destMetricType,
            sourceData
          );
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
          tcpReceived: tcpReceived
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
          reqRates: null
        });
      });

    this.setState({ loading: true, metricsLoadError: null });
  };

  private safeRate = (s: any) => {
    return isNaN(s) ? 0.0 : Number(s);
  };

  private renderCharts = (edge, isGrpc, isHttp, isTcp) => {
    if (!this.hasSupportedCharts(edge)) {
      return isGrpc || isHttp ? (
        <>
          <Icon type="pf" name="info" /> Service graphs do not support service-to-service aggregate sparklines. See the
          chart above for aggregate traffic or use the workload graph type to observe individual workload-to-service
          edge sparklines.
        </>
      ) : (
        <>
          <Icon type="pf" name="info" /> Service graphs do not support service-to-service aggregate sparklines. Use the
          workload graph type to observe individual workload-to-service edge sparklines.
        </>
      );
    }

    const data = nodeData(edge.target());
    if (data.isInaccessible) {
      return (
        <>
          <Icon type="pf" name="info" /> Sparkline charts cannot be shown because the destination is inaccessible.
        </>
      );
    }

    if (this.state.loading && !this.state.reqRates) {
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

    let rpsChart, tcpChart;
    if (isGrpc || isHttp) {
      const labelRps = isGrpc ? 'GRPC Request Traffic' : 'HTTP Request Traffic';
      const labelRt = isGrpc ? 'GRPC Request Response Time (ms)' : 'HTTP Request Response Time (ms)';
      rpsChart = (
        <>
          <RpsChart label={labelRps} dataRps={this.state.reqRates!} dataErrors={this.state.errRates} />
          <hr />
          <ResponseTimeChart
            label={labelRt}
            rtAvg={this.state.rtAvg}
            rtMed={this.state.rtMed}
            rt95={this.state.rt95}
            rt99={this.state.rt99}
          />
          <hr />
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
    const sourceData = nodeData(edge.source());
    const destData = nodeData(edge.target());
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

  private renderBadgeSummary = (mTLSPercentage: string) => {
    let mtls = 'mTLS Enabled';
    const isMtls = Number(mTLSPercentage) > 0;
    if (isMtls && Number(mTLSPercentage) < 100.0) {
      mtls = `${mtls} [${mTLSPercentage}% of request traffic]`;
    }
    return (
      <>
        {isMtls && (
          <div>
            <Icon name={icons.istio.mtls.name} type={icons.istio.mtls.type} style={{ width: '10px' }} />
            <span style={{ paddingLeft: '6px' }}>{mtls}</span>
          </div>
        )}
      </>
    );
  };
}

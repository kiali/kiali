import * as React from 'react';
import { Icon } from 'patternfly-react';

import RateTable from '../../components/SummaryPanel/RateTable';
import { RpsChart, TcpChart } from '../../components/SummaryPanel/RpsChart';
import ResponseTimeChart from '../../components/SummaryPanel/ResponseTimeChart';
import { NodeType, SummaryPanelPropType } from '../../types/Graph';
import {
  shouldRefreshData,
  nodeData,
  getDatapoints,
  getNodeMetrics,
  getNodeMetricType,
  renderPanelTitle,
  NodeData,
  NodeMetricType
} from './SummaryPanelCommon';
import Label from '../../components/Label/Label';
import { MetricGroup, Metric, Metrics } from '../../types/Metrics';
import { Response } from '../../services/Api';
import { CancelablePromise, makeCancelablePromise } from '../../utils/Common';

type SummaryPanelEdgeState = {
  loading: boolean;
  reqRates: [string, number][] | null;
  errRates: [string, number][];
  rtAvg: [string, number][];
  rtMed: [string, number][];
  rt95: [string, number][];
  rt99: [string, number][];
  tcpSent: [string, number][];
  tcpReceived: [string, number][];
  metricsLoadError: string | null;
};

export default class SummaryPanelEdge extends React.Component<SummaryPanelPropType, SummaryPanelEdgeState> {
  static readonly panelStyle = {
    width: '25em',
    minWidth: '25em',
    overflowY: 'auto' as 'auto'
  };

  private metricsPromise?: CancelablePromise<Response<Metrics>>;

  constructor(props: SummaryPanelPropType) {
    super(props);

    this.state = {
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
    const rate = this.safeRate(edge.data('rate'));
    const rate3xx = this.safeRate(edge.data('rate3XX'));
    const rate4xx = this.safeRate(edge.data('rate4XX'));
    const rate5xx = this.safeRate(edge.data('rate5XX'));

    const HeadingBlock = ({ prefix, node }) => {
      const { namespace, version } = nodeData(node);
      return (
        <div className="panel-heading label-collection">
          {prefix} {renderPanelTitle(node)}
          <br />
          {this.renderLabels(namespace, version)}
        </div>
      );
    };

    return (
      <div className="panel panel-default" style={SummaryPanelEdge.panelStyle}>
        <HeadingBlock prefix="Source" node={source} />
        <HeadingBlock prefix="Destination" node={dest} />
        <div className="panel-body">
          {this.hasHttpMetrics(edge) && (
            <>
              <RateTable
                title="HTTP Traffic (requests per second):"
                rate={rate}
                rate3xx={rate3xx}
                rate4xx={rate4xx}
                rate5xx={rate5xx}
              />
              <hr />
            </>
          )}
          {this.renderCharts(edge)}
        </div>
      </div>
    );
  }

  private getByLabelsIn = (sourceMetricType: NodeMetricType, destMetricType: NodeMetricType) => {
    let sourceLabel: string;
    switch (sourceMetricType) {
      case NodeMetricType.WORKLOAD:
        sourceLabel = 'source_workload';
        break;
      case NodeMetricType.APP:
        sourceLabel = 'source_app';
        break;
      case NodeMetricType.SERVICE:
      default:
        sourceLabel = 'destination_service_name';
        break;
    }
    // when not injecting service nodes the only service nodes are those representing client failures. For
    // those we want to narrow the data to only TS with 'unknown' workloads (see the related comparator in getNodeDatapoints).
    if (destMetricType === NodeMetricType.SERVICE && !this.props.injectServiceNodes) {
      return [sourceLabel, 'destination_workload'];
    }
    return [sourceLabel];
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
      case NodeMetricType.WORKLOAD:
        sourceLabel = 'source_workload';
        sourceValue = data.workload;
        break;
      case NodeMetricType.APP:
        sourceLabel = 'source_app';
        sourceValue = data.app;
        break;
      case NodeMetricType.SERVICE:
      default:
        sourceLabel = 'destination_service_name';
        sourceValue = data.service;
    }
    let comparator = (metric: Metric) => {
      if (destMetricType === NodeMetricType.SERVICE && !this.props.injectServiceNodes) {
        return metric[sourceLabel] === sourceValue && metric['destination_workload'] === 'unknown';
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

    if (this.metricsPromise) {
      this.metricsPromise.cancel();
      this.metricsPromise = undefined;
    }

    if (!destMetricType || !sourceMetricType || (!this.hasHttpMetrics(edge) && !this.hasTcpMetrics(edge))) {
      return;
    }

    const filters = ['request_count', 'request_duration', 'request_error_count', 'tcp_sent', 'tcp_received'];
    const quantiles = ['0.5', '0.95', '0.99'];
    const byLabelsIn = this.getByLabelsIn(sourceMetricType, destMetricType);

    const promise = getNodeMetrics(destMetricType, edge.target(), props, filters, quantiles, byLabelsIn);
    this.metricsPromise = makeCancelablePromise(promise);

    this.metricsPromise.promise
      .then(response => {
        let useDest = sourceData.nodeType === NodeType.UNKNOWN;
        useDest = useDest || this.props.namespace === 'istio-system';
        const reporter = useDest ? response.data.dest : response.data.source;
        const metrics = reporter.metrics;
        const histograms = reporter.histograms;
        const reqRates = this.getNodeDataPoints(
          metrics['request_count_in'],
          'RPS',
          sourceMetricType,
          destMetricType,
          sourceData
        );
        const errRates = this.getNodeDataPoints(
          metrics['request_error_count_in'],
          'Error',
          sourceMetricType,
          destMetricType,
          sourceData
        );
        const rtAvg = this.getNodeDataPoints(
          histograms['request_duration_in']['avg'],
          'Average',
          sourceMetricType,
          destMetricType,
          sourceData
        );
        const rtMed = this.getNodeDataPoints(
          histograms['request_duration_in']['0.5'],
          'Median',
          sourceMetricType,
          destMetricType,
          sourceData
        );
        const rt95 = this.getNodeDataPoints(
          histograms['request_duration_in']['0.95'],
          '95th',
          sourceMetricType,
          destMetricType,
          sourceData
        );
        const rt99 = this.getNodeDataPoints(
          histograms['request_duration_in']['0.99'],
          '99th',
          sourceMetricType,
          destMetricType,
          sourceData
        );
        const tcpSentRates = this.getNodeDataPoints(
          metrics['tcp_sent_in'],
          'Sent',
          sourceMetricType,
          destMetricType,
          sourceData
        );
        const tcpReceivedRates = this.getNodeDataPoints(
          metrics['tcp_received_in'],
          'Received',
          sourceMetricType,
          destMetricType,
          sourceData
        );

        this.setState({
          loading: false,
          reqRates: reqRates,
          errRates: errRates,
          rtAvg: rtAvg,
          rtMed: rtMed,
          rt95: rt95,
          rt99: rt99,
          tcpSent: tcpSentRates,
          tcpReceived: tcpReceivedRates
        });
      })
      .catch(error => {
        if (error.isCanceled) {
          console.log('SummaryPanelEdge: Ignore fetch error (canceled).');
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

  private safeRate = (s: string) => {
    return s === undefined ? 0.0 : parseFloat(s);
  };

  private renderLabels = (ns: string, ver: string) => (
    <div style={{ paddingTop: '3px' }}>
      <Label name="namespace" value={ns} />
      {ver && <Label name="version" value={ver} />}
    </div>
  );

  private renderCharts = edge => {
    if (this.state.loading && !this.state.reqRates) {
      return <strong>Loading charts...</strong>;
    } else if (this.state.metricsLoadError) {
      return (
        <div>
          <Icon type="pf" name="warning-triangle-o" /> <strong>Error loading metrics: </strong>
          {this.state.metricsLoadError}
        </div>
      );
    }

    let httpCharts, tcpCharts;
    if (this.hasHttpMetrics(edge)) {
      httpCharts = (
        <>
          <RpsChart label="HTTP Request Traffic" dataRps={this.state.reqRates!} dataErrors={this.state.errRates} />
          <hr />
          <ResponseTimeChart
            label="HTTP Request Response Time (ms)"
            rtAvg={this.state.rtAvg}
            rtMed={this.state.rtMed}
            rt95={this.state.rt95}
            rt99={this.state.rt99}
          />
          <hr />
        </>
      );
    }

    if (this.hasTcpMetrics(edge)) {
      tcpCharts = (
        <TcpChart label="TCP Traffic" sentRates={this.state.tcpSent} receivedRates={this.state.tcpReceived} />
      );
    }

    return (
      <>
        {httpCharts}
        {tcpCharts}
      </>
    );
  };

  private hasHttpMetrics = (edge): boolean => {
    if (edge.data('rate')) {
      return true;
    }
    return false;
  };

  private hasTcpMetrics = (edge): boolean => {
    if (edge.data('tcpSentRate')) {
      return true;
    }
    return false;
  };
}

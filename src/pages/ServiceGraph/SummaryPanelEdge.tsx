import * as React from 'react';
import RateTable from '../../components/SummaryPanel/RateTable';
import RpsChart from '../../components/SummaryPanel/RpsChart';
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
import { MetricGroup, Metric } from '../../types/Metrics';

type SummaryPanelEdgeState = {
  loading: boolean;
  reqRates: [string, number][];
  errRates: [string, number][];
  rtAvg: [string, number][];
  rtMed: [string, number][];
  rt95: [string, number][];
  rt99: [string, number][];
};

export default class SummaryPanelEdge extends React.Component<SummaryPanelPropType, SummaryPanelEdgeState> {
  static readonly panelStyle = {
    width: '25em',
    minWidth: '25em',
    overflowY: 'auto' as 'auto'
  };

  // avoid state changes after component is unmounted
  _isMounted: boolean = false;

  constructor(props: SummaryPanelPropType) {
    super(props);

    this.state = {
      loading: true,
      reqRates: [],
      errRates: [],
      rtAvg: [],
      rtMed: [],
      rt95: [],
      rt99: []
    };
  }

  componentDidMount() {
    this._isMounted = true;
    this.updateCharts(this.props);
  }

  componentDidUpdate(prevProps: SummaryPanelPropType) {
    if (shouldRefreshData(prevProps, this.props)) {
      this.updateCharts(this.props);
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
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
          <RateTable
            title="Traffic (requests per second):"
            rate={rate}
            rate3xx={rate3xx}
            rate4xx={rate4xx}
            rate5xx={rate5xx}
          />
          <div>
            <hr />
            {this.renderCharts()}
          </div>
        </div>
      </div>
    );
  }

  private getByLabelsIn = (sourceMetricType: NodeMetricType, destMetricType: NodeMetricType) => {
    let sourceLabel = 'source_workload';
    if (sourceMetricType === NodeMetricType.APP) {
      sourceLabel = 'source_app';
    }
    if (destMetricType === NodeMetricType.SERVICE) {
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
    let sourceLabel = 'source_workload';
    let sourceValue = data.workload;
    if (sourceMetricType === NodeMetricType.APP) {
      sourceLabel = 'source_app';
      sourceValue = data.app;
    }
    let comparator = (metric: Metric) => {
      if (destMetricType === NodeMetricType.SERVICE) {
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

    if (!destMetricType || !sourceMetricType) {
      return;
    }

    const filters = ['request_count', 'request_duration', 'request_error_count'];
    const byLabelsIn = this.getByLabelsIn(sourceMetricType, destMetricType);
    getNodeMetrics(destMetricType, edge.target(), props, filters, byLabelsIn)
      .then(response => {
        if (!this._isMounted) {
          console.log('SummaryPanelEdge: Ignore fetch, component not mounted.');
          return;
        }
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
          histograms['request_duration_in']['average'],
          'Average',
          sourceMetricType,
          destMetricType,
          sourceData
        );
        const rtMed = this.getNodeDataPoints(
          histograms['request_duration_in']['median'],
          'Median',
          sourceMetricType,
          destMetricType,
          sourceData
        );
        const rt95 = this.getNodeDataPoints(
          histograms['request_duration_in']['percentile95'],
          '95th',
          sourceMetricType,
          destMetricType,
          sourceData
        );
        const rt99 = this.getNodeDataPoints(
          histograms['request_duration_in']['percentile99'],
          '99th',
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
          rt99: rt99
        });
      })
      .catch(error => {
        if (!this._isMounted) {
          console.log('SummaryPanelEdge: Ignore fetch error, component not mounted.');
          return;
        }
        this.setState({ loading: false });
        console.error(error);
        // this.props.onError(error);
      });
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

  private renderCharts = () => {
    if (this.state.loading) {
      return <strong>loading charts...</strong>;
    }

    return (
      <>
        <RpsChart label="Request Traffic" dataRps={this.state.reqRates} dataErrors={this.state.errRates} />
        <hr />
        <ResponseTimeChart
          label="Request Response Time (ms)"
          rtAvg={this.state.rtAvg}
          rtMed={this.state.rtMed}
          rt95={this.state.rt95}
          rt99={this.state.rt99}
        />
      </>
    );
  };
}

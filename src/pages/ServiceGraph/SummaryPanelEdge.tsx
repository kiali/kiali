import * as React from 'react';
import RateTable from '../../components/SummaryPanel/RateTable';
import RpsChart from '../../components/SummaryPanel/RpsChart';
import ResponseTimeChart from '../../components/SummaryPanel/ResponseTimeChart';
import { NodeType, SummaryPanelPropType } from '../../types/Graph';
import * as M from '../../types/Metrics';
import graphUtils from '../../utils/Graphing';
import {
  shouldRefreshData,
  nodeData,
  getServicesLinkList,
  getNodeMetrics,
  NodeMetricType,
  getNodeMetricType
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
      const isAppUnknown = node.data('nodeType') === NodeType.UNKNOWN;
      const { namespace, version, app, workload } = nodeData(node);
      return (
        <div className="panel-heading label-collection">
          {prefix}: {isAppUnknown ? 'unknown' : app || workload || node.data('service')}
          <br />
          {this.renderLabels(namespace, version)}
        </div>
      );
    };

    const sourceServices = getServicesLinkList([source]);
    const destinationServices = getServicesLinkList([dest]);

    return (
      <div className="panel panel-default" style={SummaryPanelEdge.panelStyle}>
        <HeadingBlock prefix="Source" node={source} />
        <HeadingBlock prefix="Destination" node={dest} />
        <div className="panel-body">
          {sourceServices.length > 0 && (
            <div>
              <strong>Source services: </strong>
              {sourceServices}
            </div>
          )}
          {destinationServices.length > 0 && (
            <div>
              <strong>Destination services: </strong>
              {destinationServices}
            </div>
          )}
          {(destinationServices || sourceServices) && <hr />}
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

  private getByLabelsIn = (nodeMetricType: NodeMetricType) => {
    switch (nodeMetricType) {
      case NodeMetricType.WORKLOAD:
        return ['source_workload'];
      case NodeMetricType.APP:
        return ['source_app'];
      default:
        // Unreachable code, but tslint disagrees
        // https://github.com/palantir/tslint/issues/696
        throw new Error(`Unknown NodeMetricType: ${nodeMetricType}`);
    }
  };

  private getNodeDataPoints = (m: MetricGroup, title: string, nodeMetricType: NodeMetricType, node: any) => {
    const data = nodeData(node);
    let comparator;
    switch (nodeMetricType) {
      case NodeMetricType.APP:
        comparator = (metric: Metric) => {
          return metric['source_app'] === data.app;
        };
        break;
      case NodeMetricType.WORKLOAD:
        comparator = (metric: Metric) => {
          return metric['source_workload'] === data.workload;
        };
        break;
      default:
        // Unreachable code, but tslint disagrees
        // https://github.com/palantir/tslint/issues/696
        throw new Error(`Unknown NodeMetricType: ${nodeMetricType}`);
    }
    return this.getDatapoints(m, title, comparator);
  };

  private updateCharts = (props: SummaryPanelPropType) => {
    const edge = props.data.summaryTarget;
    const source = edge.source();
    const nodeMetricType = getNodeMetricType(source);

    if (!nodeMetricType) {
      return;
    }

    const filters = ['request_count', 'request_duration', 'request_error_count'];
    const byLabelsIn = this.getByLabelsIn(nodeMetricType);

    getNodeMetrics(nodeMetricType, edge.target(), props, filters, undefined, byLabelsIn)
      .then(response => {
        if (!this._isMounted) {
          console.log('SummaryPanelEdge: Ignore fetch, component not mounted.');
          return;
        }
        const metrics = response.data.metrics;
        const histograms = response.data.histograms;
        const reqRates = this.getNodeDataPoints(metrics['request_count_in'], 'RPS', nodeMetricType, source);
        const errRates = this.getNodeDataPoints(metrics['request_error_count_in'], 'Error', nodeMetricType, source);
        const rtAvg = this.getNodeDataPoints(
          histograms['request_duration_in']['average'],
          'Average',
          nodeMetricType,
          source
        );
        const rtMed = this.getNodeDataPoints(
          histograms['request_duration_in']['median'],
          'Median',
          nodeMetricType,
          source
        );
        const rt95 = this.getNodeDataPoints(
          histograms['request_duration_in']['percentile95'],
          '95th',
          nodeMetricType,
          source
        );
        const rt99 = this.getNodeDataPoints(
          histograms['request_duration_in']['percentile99'],
          '99th',
          nodeMetricType,
          source
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

  private getDatapoints = (
    mg: M.MetricGroup,
    title: string,
    comparator: (metric: Metric) => boolean
  ): [string, number][] => {
    const tsa: M.TimeSeries[] = mg.matrix;
    let series: M.TimeSeries[] = [];

    for (let i = 0; i < tsa.length; ++i) {
      const ts = tsa[i];
      if (comparator(ts.metric)) {
        series.push(ts);
      }
    }
    return graphUtils.toC3Columns(series, title);
  };
}

import * as React from 'react';
import RateTable from '../../components/SummaryPanel/RateTable';
import RpsChart from '../../components/SummaryPanel/RpsChart';
import ResponseTimeChart from '../../components/SummaryPanel/ResponseTimeChart';
import { NodeType, SummaryPanelPropType } from '../../types/Graph';
import * as API from '../../services/Api';
import * as M from '../../types/Metrics';
import graphUtils from '../../utils/Graphing';
import MetricsOptions from '../../types/MetricsOptions';
import { authentication } from '../../utils/Authentication';
import { shouldRefreshData, nodeData, getServicesLinkList } from './SummaryPanelCommon';
import Label from '../../components/Label/Label';

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

  private updateCharts = (props: SummaryPanelPropType) => {
    const edge = props.data.summaryTarget;
    const source = nodeData(edge.source());
    const dest = nodeData(edge.target());

    const options: MetricsOptions = {
      version: dest.version,
      byLabelsIn: ['source_service', 'source_version'],
      queryTime: props.queryTime,
      duration: +props.duration,
      step: props.step,
      rateInterval: props.rateInterval,
      filters: ['request_count', 'request_duration', 'request_error_count']
    };
    API.getServiceMetrics(authentication(), dest.namespace, dest.app, options)
      .then(response => {
        if (!this._isMounted) {
          console.log('SummaryPanelEdge: Ignore fetch, component not mounted.');
          return;
        }
        const metrics = response.data.metrics;
        const histograms = response.data.histograms;
        const reqRates = this.getDatapoints(metrics['request_count_in'], 'RPS', source.app, source.version);
        const errRates = this.getDatapoints(metrics['request_error_count_in'], 'Error', source.app, source.version);
        const rtAvg = this.getDatapoints(
          histograms['request_duration_in']['average'],
          'Average',
          source.app,
          source.version
        );
        const rtMed = this.getDatapoints(
          histograms['request_duration_in']['median'],
          'Median',
          source.app,
          source.version
        );
        const rt95 = this.getDatapoints(
          histograms['request_duration_in']['percentile95'],
          '95th',
          source.app,
          source.version
        );
        const rt99 = this.getDatapoints(
          histograms['request_duration_in']['percentile99'],
          '99th',
          source.app,
          source.version
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
    sourceService: string,
    sourceVersion: string
  ): [string, number][] => {
    const tsa: M.TimeSeries[] = mg.matrix;
    let series: M.TimeSeries[] = [];

    for (let i = 0; i < tsa.length; ++i) {
      const ts = tsa[i];
      if (ts.metric['source_service'] === sourceService && ts.metric['source_version'] === sourceVersion) {
        series.push(ts);
      }
    }
    return graphUtils.toC3Columns(series, title);
  };
}

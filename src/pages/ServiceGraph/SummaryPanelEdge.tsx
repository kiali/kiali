import * as React from 'react';
import Badge from '../../components/Badge/Badge';
import RateTable from '../../components/SummaryPanel/RateTable';
import RpsChart from '../../components/SummaryPanel/RpsChart';
import LatencyChart from '../../components/SummaryPanel/LatencyChart';
import { SummaryPanelPropType } from '../../types/Graph';
import * as API from '../../services/Api';
import * as M from '../../types/Metrics';
import graphUtils from '../../utils/Graphing';
import MetricsOptions from '../../types/MetricsOptions';
import { PfColors } from '../../components/Pf/PfColors';
import { authentication } from '../../utils/Authentication';

type SummaryPanelEdgeState = {
  loading: boolean;
  reqRates: [string, number][];
  errRates: [string, number][];
  latAvg: [string, number][];
  latMed: [string, number][];
  lat95: [string, number][];
  lat99: [string, number][];
};

export default class SummaryPanelEdge extends React.Component<SummaryPanelPropType, SummaryPanelEdgeState> {
  static readonly panelStyle = {
    position: 'absolute' as 'absolute',
    width: '25em',
    top: 0,
    right: 0,
    bottom: 0,
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
      latAvg: [],
      latMed: [],
      lat95: [],
      lat99: []
    };
  }

  componentDidMount() {
    this._isMounted = true;
    this.updateCharts(this.props);
  }

  componentWillReceiveProps(nextProps: SummaryPanelPropType) {
    if (nextProps.data.summaryTarget && nextProps.data.summaryTarget !== this.props.data.summaryTarget) {
      this.updateCharts(nextProps);
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    const edge = this.props.data.summaryTarget;
    const source = edge.source();
    const sourceService = source.data('service');
    const sourceVersion = source.data('version');
    const sourceSplit = sourceService.split('.');
    const sourceServiceName = sourceSplit[0];
    const sourceNamespace = sourceSplit.length < 2 ? 'unknown' : sourceSplit[1];
    const dest = edge.target();
    const destService = dest.data('service');
    const destVersion = dest.data('version');
    const destSplit = destService.split('.');
    const destServiceName = destSplit[0];
    const destNamespace = destSplit[1];
    const rate = this.safeRate(edge.data('rate'));
    const rate3xx = this.safeRate(edge.data('rate3XX'));
    const rate4xx = this.safeRate(edge.data('rate4XX'));
    const rate5xx = this.safeRate(edge.data('rate5XX'));
    const sourceLink = (
      <a href={`../namespaces/${sourceNamespace}/services/${sourceServiceName}`}>{sourceServiceName}</a>
    );
    const destLink = <a href={`../namespaces/${destNamespace}/services/${destServiceName}`}>{destServiceName}</a>;

    const isUnknown = sourceServiceName === 'unknown';
    return (
      <div className="panel panel-default" style={SummaryPanelEdge.panelStyle}>
        <div className="panel-heading">
          Source: {isUnknown ? 'unknown' : sourceLink}
          {this.renderLabels(sourceNamespace, sourceVersion)}
        </div>
        <div className="panel-heading">
          Destination: {destLink}
          {this.renderLabels(destNamespace, destVersion)}
        </div>
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

  private updateCharts = (props: SummaryPanelPropType) => {
    const edge = props.data.summaryTarget;
    const source = edge.source();
    const sourceService = source.data('service');
    const sourceVersion = source.data('version');
    const dest = edge.target();
    const destVersion = dest.data('version');
    const destSplit = dest.data('service').split('.');
    const destServiceName = destSplit[0];
    const destNamespace = destSplit[1];

    const options: MetricsOptions = {
      version: destVersion,
      byLabelsIn: ['source_service', 'source_version'],
      queryTime: props.queryTime,
      duration: +props.duration,
      step: props.step,
      rateInterval: props.rateInterval,
      filters: ['request_count', 'request_duration', 'request_error_count']
    };
    API.getServiceMetrics(authentication(), destNamespace, destServiceName, options)
      .then(response => {
        if (!this._isMounted) {
          console.log('SummaryPanelEdge: Ignore fetch, component not mounted.');
          return;
        }
        const metrics = response.data.metrics;
        const histograms = response.data.histograms;
        const reqRates = this.getDatapoints(metrics['request_count_in'], 'RPS', sourceService, sourceVersion);
        const errRates = this.getDatapoints(metrics['request_error_count_in'], 'Error', sourceService, sourceVersion);
        const latAvg = this.getDatapoints(
          histograms['request_duration_in']['average'],
          'Average',
          sourceService,
          sourceVersion
        );
        const latMed = this.getDatapoints(
          histograms['request_duration_in']['median'],
          'Median',
          sourceService,
          sourceVersion
        );
        const lat95 = this.getDatapoints(
          histograms['request_duration_in']['percentile95'],
          '95th',
          sourceService,
          sourceVersion
        );
        const lat99 = this.getDatapoints(
          histograms['request_duration_in']['percentile99'],
          '99th',
          sourceService,
          sourceVersion
        );

        this.setState({
          loading: false,
          reqRates: reqRates,
          errRates: errRates,
          latAvg: latAvg,
          latMed: latMed,
          lat95: lat95,
          lat99: lat99
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
      <Badge scale={0.9} style="plastic" leftText="namespace" rightText={ns} color={PfColors.Green400} />
      <Badge scale={0.9} style="plastic" leftText="version" rightText={ver} color={PfColors.Green400} />
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
        <LatencyChart
          label="Request Latency (ms)"
          latAvg={this.state.latAvg}
          latMed={this.state.latMed}
          lat95={this.state.lat95}
          lat99={this.state.lat99}
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

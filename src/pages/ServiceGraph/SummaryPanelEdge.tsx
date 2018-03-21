import * as React from 'react';
import ServiceInfoBadge from '../../pages/ServiceDetails/ServiceInfo/ServiceInfoBadge';
import { RateTable } from '../../components/SummaryPanel/RateTable';
import { RpsChart } from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType } from '../../types/Graph';
import * as API from '../../services/Api';
import * as M from '../../types/Metrics';
import graphUtils from '../../utils/graphing';

type SummaryPanelEdgeState = {
  loading: boolean;
  sourceService: string;
  sourceServiceName: string;
  sourceNamespace: string;
  sourceVersion: string;
  dest: string;
  destService: string;
  destServiceName: string;
  destNamespace: string;
  destVersion: string;
  reqRates: [string, number][];
  errRates: [string, number][];
};

export default class SummaryPanelEdge extends React.Component<SummaryPanelPropType, SummaryPanelEdgeState> {
  static readonly panelStyle = {
    position: 'absolute' as 'absolute',
    width: '25em',
    top: 0,
    right: 0
  };

  constructor(props: SummaryPanelPropType) {
    super(props);

    const edge = this.props.data.summaryTarget;
    const source = edge.source();
    const sourceService = source.data('service');
    const sourceSplit = sourceService.split('.');
    const dest = edge.target();
    const destService = dest.data('service');
    const destSplit = dest.data('service').split('.');

    this.state = {
      loading: true,
      sourceService: sourceService,
      sourceServiceName: sourceSplit[0],
      sourceNamespace: sourceSplit.length < 2 ? 'unknown' : sourceSplit[1],
      sourceVersion: source.data('version'),
      dest: dest.data('service'),
      destService: destService,
      destServiceName: destSplit[0],
      destNamespace: destSplit[1],
      destVersion: dest.data('version'),
      reqRates: [],
      errRates: []
    };
  }

  componentDidMount() {
    const options = {
      version: this.state.destVersion,
      'byLabelsIn[]': 'source_service,source_version',
      rateInterval: this.props.rateInterval
    };
    API.getServiceMetrics(this.state.destNamespace, this.state.destServiceName, options)
      .then(response => {
        const data: M.Metrics = response['data'];
        const metrics: Map<String, M.MetricGroup> = data.metrics;
        const reqRates = this.getRates(metrics['request_count_in'], 'RPS');
        const errRates = this.getRates(metrics['request_error_count_in'], 'Error');

        this.setState({
          loading: false,
          reqRates: reqRates,
          errRates: errRates
        });
      })
      .catch(error => {
        this.setState({ loading: false });
        console.error(error);
        // this.props.onError(error);
      });
  }

  render() {
    const edge = this.props.data.summaryTarget;
    const rate = this.safeRate(edge.data('rate'));
    const rate3xx = this.safeRate(edge.data('rate3XX'));
    const rate4xx = this.safeRate(edge.data('rate4XX'));
    const rate5xx = this.safeRate(edge.data('rate5XX'));
    const sourceLink = (
      <a href={`../namespaces/${this.state.sourceNamespace}/services/${this.state.sourceService}`}>
        {this.state.sourceService}
      </a>
    );
    const destLink = (
      <a href={`../namespaces/${this.state.destNamespace}/services/${this.state.destService}`}>
        {this.state.destService}
      </a>
    );

    return (
      <div className="panel panel-default" style={SummaryPanelEdge.panelStyle}>
        <div className="panel-heading">Edge Source: {sourceLink}</div>
        <div className="panel-body">
          <p>{this.renderLabels(this.state.sourceNamespace, this.state.sourceVersion)}</p>
        </div>
        <div className="panel-heading">Edge Dest: {destLink}</div>
        <div className="panel-body">
          <p>{this.renderLabels(this.state.destNamespace, this.state.destVersion)}</p>
          <hr />
          <RateTable
            title="Traffic (requests per second):"
            rate={rate}
            rate3xx={rate3xx}
            rate4xx={rate4xx}
            rate5xx={rate5xx}
          />
          <div>
            <hr />
            {this.renderRpsChart()}
          </div>
        </div>
      </div>
    );
  }

  private safeRate = (s: string) => {
    return s === undefined ? 0.0 : parseFloat(s);
  };

  private renderLabels = (ns: string, ver: string) => (
    <>
      <ServiceInfoBadge scale={0.8} style="plastic" leftText="namespace" rightText={ns} color="green" />
      <ServiceInfoBadge scale={0.8} style="plastic" leftText="version" rightText={ver} color="green" />
    </>
  );

  private renderRpsChart = () => {
    if (this.state.loading) {
      return <strong>loading chart...</strong>;
    }

    return <RpsChart label="Request Average" dataRps={this.state.reqRates} dataErrors={this.state.errRates} />;
  };

  private getRates = (mg: M.MetricGroup, title: string): [string, number][] => {
    const tsa: M.TimeSeries[] = mg.matrix;
    let series: M.TimeSeries[] = [];

    for (let i = 0; i < tsa.length; ++i) {
      const ts = tsa[i];
      if (
        ts.metric['source_service'] === this.state.sourceService &&
        ts.metric['source_version'] === this.state.sourceVersion
      ) {
        series.push(ts);
      }
    }
    return graphUtils.toC3Columns(series, title);
  };
}

import * as React from 'react';
import ServiceInfoBadge from '../../pages/ServiceDetails/ServiceInfo/ServiceInfoBadge';
import { RateTable } from '../../components/SummaryPanel/RateTable';
import { RpsChart } from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType } from '../../types/Graph';
import * as API from '../../services/Api';
import * as M from '../../types/Metrics';

type SummaryPanelEdgeState = {
  loading: boolean;
  source: string;
  sourceService: string;
  sourceNamespace: string;
  sourceVersion: string;
  dest: string;
  destService: string;
  destNamespace: string;
  destVersion: string;
  reqRates: number[];
  errRates: number[];
};

export default class SummaryPanelEdge extends React.Component<SummaryPanelPropType, SummaryPanelEdgeState> {
  static readonly panelStyle = {
    position: 'absolute' as 'absolute',
    width: '25em',
    bottom: 0,
    top: 0,
    right: 0
  };

  constructor(props: SummaryPanelPropType) {
    super(props);

    const edge = this.props.data.summaryTarget;
    const source = edge.source();
    const sourceSplit = source.data('service').split('.');
    const dest = edge.target();
    const destSplit = dest.data('service').split('.');

    this.state = {
      loading: true,
      source: source.data('service'),
      sourceService: sourceSplit[0],
      sourceNamespace: sourceSplit.length < 2 ? 'unknown' : sourceSplit[1],
      sourceVersion: source.data('version'),
      dest: dest.data('service'),
      destService: destSplit[0],
      destNamespace: destSplit[1],
      destVersion: dest.data('version'),
      reqRates: [],
      errRates: []
    };
  }

  componentDidMount() {
    const options = {
      version: this.state.destVersion,
      'byLabelsIn[]': 'source_service,source_version'
    };
    API.getServiceMetrics(this.state.destNamespace, this.state.destService, options)
      .then(response => {
        const data: M.Metrics = response['data'];
        const metrics: Map<String, M.MetricGroup> = data.metrics;
        const mg: M.MetricGroup = metrics['request_count_in'];
        const tsa: M.TimeSeries[] = mg.matrix;
        let reqRates: number[] = [];
        let errRates: number[] = [];
        for (let i = 0; i < tsa.length; ++i) {
          const ts = tsa[i];
          if (
            ts.metric['source_service'] === this.state.source &&
            ts.metric['source_version'] === this.state.sourceVersion
          ) {
            const vals: M.Datapoint[] = ts.values;
            for (let j = 0; j < vals.length; ++j) {
              reqRates.push(vals[j][1]);
              errRates.push(vals[j][1] / 2);
            }
          }
        }

        this.setState({
          loading: false,
          reqRates: reqRates,
          errRates: errRates
        });
        // console.log('Group metrics:' + JSON.stringify(this.state));
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
          <div style={{ fontSize: '1.2em' }}>
            <hr />
            {this.renderRpsChart()}
          </div>
        </div>
      </div>
    );
  }

  safeRate = (s: string) => {
    return s === undefined ? 0.0 : parseFloat(s);
  };

  renderLabels = (ns: string, ver: string) => (
    <>
      <ServiceInfoBadge scale={0.8} style="plastic" leftText="namespace" rightText={ns} color="green" />
      <ServiceInfoBadge scale={0.8} style="plastic" leftText="version" rightText={ver} color="green" />
    </>
  );

  renderRpsChart = () => {
    return <RpsChart label="Request Rates" dataRps={this.state.reqRates} dataErrors={this.state.errRates} />;
  };
}

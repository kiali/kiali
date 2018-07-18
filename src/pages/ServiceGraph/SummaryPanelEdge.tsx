import * as React from 'react';
import RateTable from '../../components/SummaryPanel/RateTable';
import RpsChart from '../../components/SummaryPanel/RpsChart';
import ResponseTimeChart from '../../components/SummaryPanel/ResponseTimeChart';
import { SummaryPanelPropType } from '../../types/Graph';
import * as API from '../../services/Api';
import * as M from '../../types/Metrics';
import graphUtils from '../../utils/Graphing';
import MetricsOptions from '../../types/MetricsOptions';
import { authentication } from '../../utils/Authentication';
import { Icon } from 'patternfly-react';
import { Link } from 'react-router-dom';
import { shouldRefreshData } from './SummaryPanelCommon';
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
      <Link to={`/namespaces/${sourceNamespace}/services/${sourceServiceName}`}>{sourceServiceName}</Link>
    );
    const destLink = <Link to={`/namespaces/${destNamespace}/services/${destServiceName}`}>{destServiceName}</Link>;

    const isUnknown = sourceServiceName === 'unknown';
    return (
      <div className="panel panel-default" style={SummaryPanelEdge.panelStyle}>
        <div className="panel-heading label-collection">
          Source: {isUnknown ? 'unknown' : sourceLink}
          {this.renderLabels(sourceNamespace, sourceVersion)}
        </div>
        <div className="panel-heading label-collection">
          Destination: {destLink}
          {this.renderLabels(destNamespace, destVersion)}
        </div>
        <div className="panel-body">
          <p style={{ textAlign: 'right' }}>
            <Link
              to={
                (isUnknown ? destLink.props.to : sourceLink.props.to) +
                '?tab=metrics&groupings=local+version%2Cremote+service%2Cremote+version%2Cresponse+code'
              }
            >
              View detailed charts <Icon name="angle-double-right" />
            </Link>
          </p>
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
        const rtAvg = this.getDatapoints(
          histograms['request_duration_in']['average'],
          'Average',
          sourceService,
          sourceVersion
        );
        const rtMed = this.getDatapoints(
          histograms['request_duration_in']['median'],
          'Median',
          sourceService,
          sourceVersion
        );
        const rt95 = this.getDatapoints(
          histograms['request_duration_in']['percentile95'],
          '95th',
          sourceService,
          sourceVersion
        );
        const rt99 = this.getDatapoints(
          histograms['request_duration_in']['percentile99'],
          '99th',
          sourceService,
          sourceVersion
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
      <Label name="version" value={ver} />
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

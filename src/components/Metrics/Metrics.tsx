import * as React from 'react';
import { Alert, Icon } from 'patternfly-react';
import GrafanaInfo from '../../types/GrafanaInfo';
import { authentication } from '../../utils/Authentication';
import * as API from '../../services/Api';
import { computePrometheusQueryInterval } from '../../services/Prometheus';
import MetricsOptionsBar from '../../components/MetricsOptions/MetricsOptionsBar';
import MetricsOptions from '../../types/MetricsOptions';
import HistogramChart from './HistogramChart';
import MetricChart from './MetricChart';
import { Histogram, MetricGroup } from '../../types/Metrics';
import history from '../../app/History';
import { HistoryManager } from '../../app/History';
import { Link } from 'react-router-dom';
import { style } from 'typestyle';

const expandedChartContainerStyle = style({
  height: 'calc(100vh - 248px)'
});

const expandedChartBackLinkStyle = style({
  marginTop: '-1.7em',
  textAlign: 'right'
});

type ChartDefinition = {
  familyName: string;
  component: any;
  metrics?: MetricGroup | Histogram;
};

type MetricsState = {
  alertDetails?: string;
  grafanaLink?: string;
  pollMetrics?: number;
  metricReporter: string;
  metricData?: any;
};

type ObjectId = {
  namespace: string;
  object: string;
};

type MetricsProps = ObjectId & {
  isPageVisible?: boolean;
  objectType: string;
  metricsType: string;
};

class Metrics extends React.Component<MetricsProps, MetricsState> {
  static defaultProps = {
    isPageVisible: true
  };

  options: MetricsOptions;

  constructor(props: MetricsProps) {
    super(props);

    let metricReporter = 'source';

    const metricReporterParam = HistoryManager.getParam('reporter');
    if (metricReporterParam != null) {
      metricReporter = metricReporterParam;
    } else if (this.props.metricsType === 'inbound') {
      metricReporter = 'destination';
    }

    this.state = {
      metricReporter: metricReporter
    };
  }

  getChartsDef(): { [key: string]: ChartDefinition } {
    let inboundCharts = {
      request_count_in: { familyName: 'Request volume (ops)', component: MetricChart },
      request_duration_in: { familyName: 'Request duration (seconds)', component: HistogramChart },
      request_size_in: { familyName: 'Request size (bytes)', component: HistogramChart },
      response_size_in: { familyName: 'Response size (bytes)', component: HistogramChart },
      tcp_received_in: { familyName: 'TCP received (bps)', component: MetricChart },
      tcp_sent_in: { familyName: 'TCP sent (bps)', component: MetricChart }
    };
    let charts: { [key: string]: ChartDefinition } = inboundCharts;

    if (this.props.metricsType === 'outbound') {
      charts = {
        request_count_out: { familyName: 'Request volume (ops)', component: MetricChart },
        request_duration_out: { familyName: 'Request duration (seconds)', component: HistogramChart },
        request_size_out: { familyName: 'Request size (bytes)', component: HistogramChart },
        response_size_out: { familyName: 'Response size (bytes)', component: HistogramChart },
        tcp_received_out: { familyName: 'TCP received (bps)', component: MetricChart },
        tcp_sent_out: { familyName: 'TCP sent (bps)', component: MetricChart }
      };
    }

    if (this.state.metricData) {
      Object.keys(charts).forEach(k => {
        const chart = charts[k];
        const reporter = this.state.metricReporter === 'destination' ? 'dest' : 'source';
        const histo = this.state.metricData[reporter].histograms[k];

        if (histo) {
          chart.metrics = histo;
        } else {
          chart.metrics = this.state.metricData[reporter].metrics[k];
        }
      });
    }

    return charts;
  }

  componentDidMount() {
    this.getGrafanaInfo();
  }

  componentWillUnmount() {
    if (this.state.pollMetrics) {
      clearInterval(this.state.pollMetrics);
    }
  }

  onOptionsChanged = (options: MetricsOptions) => {
    this.options = options;
    options.filters = [
      'request_count',
      'request_size',
      'request_duration',
      'response_size',
      'tcp_received',
      'tcp_sent'
    ];
    const intervalOpts = computePrometheusQueryInterval(options.duration!);
    options.step = intervalOpts.step;
    options.rateInterval = intervalOpts.rateInterval;
    this.fetchMetrics();
    HistoryManager.setParam('duration', options.duration!.toString(10));
  };

  onPollIntervalChanged = (pollInterval: number) => {
    let newRefInterval: number | undefined = undefined;
    if (this.state.pollMetrics) {
      clearInterval(this.state.pollMetrics);
    }
    if (pollInterval > 0) {
      newRefInterval = window.setInterval(this.fetchMetrics, pollInterval);
    }
    this.setState({ pollMetrics: newRefInterval });
    HistoryManager.setParam('pi', pollInterval.toString(10));
  };

  onReporterChanged = (reporter: string) => {
    this.setState({ metricReporter: reporter });
    HistoryManager.setParam('reporter', reporter);
  };

  fetchMetrics = () => {
    let promise;
    switch (this.props.objectType) {
      case 'service':
        promise = API.getServiceMetrics(authentication(), this.props.namespace, this.props.object, this.options);
        break;
      case 'workload':
        promise = API.getWorkloadMetrics(authentication(), this.props.namespace, this.props.object, this.options);
        break;
      case 'app':
        promise = API.getAppMetrics(authentication(), this.props.namespace, this.props.object, this.options);
        break;
      default:
        promise = API.getServiceMetrics(authentication(), this.props.namespace, this.props.object, this.options);
        break;
    }
    Promise.all([promise])
      .then(([response]) => {
        this.setState({ metricData: response.data });
      })
      .catch(error => {
        this.setState({ alertDetails: API.getErrorMsg('Cannot fetch metrics.', error) });
        console.error(error);
      });
  };

  getGrafanaLink(info: GrafanaInfo): string {
    let grafanaLink;
    switch (this.props.objectType) {
      case 'service':
        grafanaLink = `${info.url}${info.serviceDashboardPath}?${info.varService}=${this.props.object}.${
          this.props.namespace
        }.svc.cluster.local`;
        break;
      case 'workload':
        grafanaLink = `${info.url}${info.workloadDashboardPath}?${info.varNamespace}=${this.props.namespace}&${
          info.varWorkload
        }=${this.props.object}`;
        break;
      default:
        grafanaLink = `${info.url}${info.workloadDashboardPath}?${info.varNamespace}=${this.props.namespace}`;
    }
    return grafanaLink;
  }

  getGrafanaInfo = () => {
    API.getGrafanaInfo(authentication())
      .then(response => {
        const info: GrafanaInfo = response['data'];
        if (info) {
          this.setState({
            grafanaLink: this.getGrafanaLink(info)
          });
        } else {
          this.setState({ grafanaLink: undefined });
        }
      })
      .catch(error => {
        this.setState({ grafanaLink: undefined });
        console.error(error);
      });
  };

  dismissAlert = () => this.setState({ alertDetails: undefined });

  render() {
    const urlParams = new URLSearchParams(history.location.search);
    const expandedChart = urlParams.get('expand');
    urlParams.delete('expand');
    const notExpandedLink = history.location.pathname + '?' + urlParams.toString();

    return (
      <div>
        {expandedChart && (
          <h3 className={expandedChartBackLinkStyle}>
            <Link to={notExpandedLink}>
              <Icon name="angle-double-left" /> View all metrics
            </Link>
          </h3>
        )}
        {this.state.alertDetails && <Alert onDismiss={this.dismissAlert}>{this.state.alertDetails}</Alert>}
        <MetricsOptionsBar
          onOptionsChanged={this.onOptionsChanged}
          onPollIntervalChanged={this.onPollIntervalChanged}
          onReporterChanged={this.onReporterChanged}
          onManualRefresh={this.fetchMetrics}
          metricReporter={this.state.metricReporter}
        />
        {expandedChart ? this.renderExpandedChart(expandedChart) : this.renderMetrics()}
      </div>
    );
  }

  renderMetrics() {
    if (!this.props.isPageVisible) {
      return null;
    }

    let charts = this.getChartsDef();

    return (
      <div className="card-pf">
        <div className="row row-cards-pf">
          <div className="col-xs-12">
            <div className="card-pf-accented card-pf-aggregate-status">
              <div className="card-pf-body">
                {Object.keys(charts).map(key => this.renderNormalChart(key, charts[key]))}
              </div>
            </div>
          </div>
          {this.state.grafanaLink && (
            <span id="grafana-link">
              <a href={this.state.grafanaLink} target="_blank">
                View in Grafana
              </a>
            </span>
          )}
        </div>
      </div>
    );
  }

  private renderNormalChart(chartKey: string, chart: ChartDefinition) {
    return this.renderChart(chartKey, chart);
  }

  private renderExpandedChart(chartKey: string) {
    return (
      <div className={expandedChartContainerStyle}>
        {this.renderChart(chartKey, this.getChartsDef()[chartKey], true)}
      </div>
    );
  }

  private renderChart(chartKey: string, chart: ChartDefinition, isExpanded: boolean = false) {
    if (!chart || !chart.metrics) {
      return undefined;
    }
    const props: any = {
      key: chartKey + this.state.metricReporter,
      familyName: chart.familyName
    };
    if ((chart.metrics as MetricGroup).matrix) {
      props.series = (chart.metrics as MetricGroup).matrix;
    } else {
      props.histogram = chart.metrics;
    }

    if (!isExpanded) {
      props.onExpandRequested = () => this.onExpandHandler(chartKey);
    }

    return React.createElement(chart.component, props);
  }

  private onExpandHandler = (chartKey: string): void => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set('expand', chartKey);
    history.push(history.location.pathname + '?' + urlParams.toString());
  };
}

export { MetricsProps };
export default Metrics;

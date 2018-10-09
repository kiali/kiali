import * as React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Icon } from 'patternfly-react';
import { style } from 'typestyle';

import history, { HistoryManager, URLParams } from '../../app/History';
import MetricsOptionsBar from '../../components/MetricsOptions/MetricsOptionsBar';
import * as API from '../../services/Api';
import { computePrometheusQueryInterval } from '../../services/Prometheus';
import GrafanaInfo from '../../types/GrafanaInfo';
import { Histogram, MetricGroup, MetricsDirection, MetricsObjectTypes } from '../../types/Metrics';
import MetricsOptions from '../../types/MetricsOptions';
import { authentication } from '../../utils/Authentication';

import HistogramChart from './HistogramChart';
import MetricChart from './MetricChart';

const expandedChartContainerStyle = style({
  height: 'calc(100vh - 248px)'
});

const expandedChartBackLinkStyle = style({
  marginTop: '-1.7em',
  textAlign: 'right'
});

type ChartDefinition = {
  name: string;
  unit: string;
  component: any;
  metrics?: MetricGroup | Histogram;
};

type MetricsState = {
  alertDetails?: string;
  grafanaLink?: string;
  metricReporter: string;
  metricData?: any;
};

type ObjectId = {
  namespace: string;
  object: string;
};

type MetricsProps = ObjectId & {
  isPageVisible?: boolean;
  objectType: MetricsObjectTypes;
  direction: MetricsDirection;
};

class Metrics extends React.Component<MetricsProps, MetricsState> {
  static defaultProps = {
    isPageVisible: true
  };

  options: MetricsOptions;

  constructor(props: MetricsProps) {
    super(props);

    let metricReporter = 'source';

    const metricReporterParam = HistoryManager.getParam(URLParams.REPORTER);
    if (metricReporterParam != null) {
      metricReporter = metricReporterParam;
    } else if (this.props.direction === MetricsDirection.INBOUND) {
      metricReporter = 'destination';
    }

    this.state = {
      metricReporter: metricReporter
    };
  }

  getChartsDef(): { [key: string]: ChartDefinition } {
    let inboundCharts = {
      request_count_in: { name: 'Request volume', unit: 'ops', component: MetricChart },
      request_duration_in: { name: 'Request duration', unit: 's', component: HistogramChart },
      request_size_in: { name: 'Request size', unit: 'B', component: HistogramChart },
      response_size_in: { name: 'Response size', unit: 'B', component: HistogramChart },
      tcp_received_in: { name: 'TCP received', unit: 'bps', component: MetricChart },
      tcp_sent_in: { name: 'TCP sent', unit: 'bps', component: MetricChart }
    };
    let charts: { [key: string]: ChartDefinition } = inboundCharts;

    if (this.props.direction === MetricsDirection.OUTBOUND) {
      charts = {
        request_count_out: { name: 'Request volume', unit: 'ops', component: MetricChart },
        request_duration_out: { name: 'Request duration', unit: 's', component: HistogramChart },
        request_size_out: { name: 'Request size', unit: 'B', component: HistogramChart },
        response_size_out: { name: 'Response size', unit: 'B', component: HistogramChart },
        tcp_received_out: { name: 'TCP received', unit: 'bps', component: MetricChart },
        tcp_sent_out: { name: 'TCP sent', unit: 'bps', component: MetricChart }
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
  };

  onReporterChanged = (reporter: string) => {
    this.setState({ metricReporter: reporter });
  };

  fetchMetrics = () => {
    let promise;
    switch (this.props.objectType) {
      case MetricsObjectTypes.WORKLOAD:
        promise = API.getWorkloadMetrics(authentication(), this.props.namespace, this.props.object, this.options);
        break;
      case MetricsObjectTypes.APP:
        promise = API.getAppMetrics(authentication(), this.props.namespace, this.props.object, this.options);
        break;
      case MetricsObjectTypes.SERVICE:
      default:
        promise = API.getServiceMetrics(authentication(), this.props.namespace, this.props.object, this.options);
        break;
    }
    promise
      .then(response => {
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
      case MetricsObjectTypes.SERVICE:
        grafanaLink = `${info.url}${info.serviceDashboardPath}?${info.varService}=${this.props.object}.${
          this.props.namespace
        }.svc.cluster.local`;
        break;
      case MetricsObjectTypes.WORKLOAD:
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
        if (response.data) {
          this.setState({
            grafanaLink: this.getGrafanaLink(response.data)
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
          onReporterChanged={this.onReporterChanged}
          onRefresh={this.fetchMetrics}
          metricReporter={this.state.metricReporter}
          direction={this.props.direction}
        />
        {expandedChart ? this.renderExpandedChart(expandedChart) : this.renderMetrics()}
      </div>
    );
  }

  renderMetrics() {
    if (!this.props.isPageVisible) {
      return null;
    }

    const charts = this.getChartsDef();

    return (
      <div className="card-pf">
        <div className="row row-cards-pf">
          <div className="col-xs-12">
            <div className="card-pf-accented card-pf-aggregate-status">
              <div className="card-pf-body">{Object.keys(charts).map(key => this.renderChart(key, charts[key]))}</div>
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
      chartName: chart.name,
      unit: chart.unit
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

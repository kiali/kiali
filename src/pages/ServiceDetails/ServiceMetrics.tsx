import * as React from 'react';
import { Alert, Icon } from 'patternfly-react';
import ServiceId from '../../types/ServiceId';
import * as M from '../../types/Metrics';
import GrafanaInfo from '../../types/GrafanaInfo';
import * as API from '../../services/Api';
import { computePrometheusQueryInterval } from '../../services/Prometheus';
import MetricsOptionsBar from '../../components/MetricsOptions/MetricsOptionsBar';
import MetricsOptions from '../../types/MetricsOptions';
import { authentication } from '../../utils/Authentication';
import HistogramChart from './HistogramChart';
import MetricChart from './MetricChart';
import { Histogram, MetricGroup } from '../../types/Metrics';
import history from '../../app/History';
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

type ServiceMetricsState = {
  charts: { [key: string]: ChartDefinition };
  alertDetails?: string;
  grafanaLink?: string;
  pollMetrics?: number;
};

type ServiceMetricsProps = ServiceId & {
  isPageVisible?: boolean;
};

class ServiceMetrics extends React.Component<ServiceMetricsProps, ServiceMetricsState> {
  static defaultProps = {
    isPageVisible: true
  };

  options: MetricsOptions;

  constructor(props: ServiceMetricsProps) {
    super(props);
    this.state = {
      charts: {
        request_count_in: { familyName: 'Request volume (ops)', component: MetricChart },
        request_duration_in: { familyName: 'Request duration (seconds)', component: HistogramChart },
        request_size_in: { familyName: 'Request size (bytes)', component: HistogramChart },
        response_size_in: { familyName: 'Response size (bytes)', component: HistogramChart },
        tcp_received_in: { familyName: 'TCP received (bps)', component: MetricChart },
        tcp_sent_in: { familyName: 'TCP sent (bps)', component: MetricChart }
      }
    };
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
  };

  fetchMetrics = () => {
    API.getServiceMetrics(authentication(), this.props.namespace, this.props.service, this.options)
      .then(response => {
        const metrics: M.Metrics = response.data;
        this.setState(prevState => {
          Object.keys(prevState.charts).forEach(k => {
            const chart = prevState.charts[k];
            const histo = metrics.histograms[k];
            if (histo) {
              chart.metrics = histo;
            } else {
              chart.metrics = metrics.metrics[k];
            }
          });
          return prevState;
        });
      })
      .catch(error => {
        this.setState({ alertDetails: API.getErrorMsg('Cannot fetch metrics.', error) });
        console.error(error);
      });
  };

  getGrafanaInfo() {
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
  }

  getGrafanaLink(info: GrafanaInfo): string {
    return `${info.url}${info.serviceDashboardPath}?${info.varService}=${this.props.service}.${
      this.props.namespace
    }.svc.cluster.local`;
  }

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
          onManualRefresh={this.fetchMetrics}
        />
        {expandedChart ? this.renderExpandedChart(expandedChart) : this.renderMetrics()}
      </div>
    );
  }

  renderMetrics() {
    if (!this.props.isPageVisible) {
      return null;
    }
    return (
      <div className="card-pf">
        <div className="row row-cards-pf">
          <div className="col-xs-12">
            <div className="card-pf-accented card-pf-aggregate-status">
              <div className="card-pf-body">
                {Object.keys(this.state.charts).map(key => this.renderNormalChart(key))}
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

  private renderNormalChart(chartKey: string) {
    return this.renderChart(chartKey);
  }

  private renderExpandedChart(chartKey: string) {
    return <div className={expandedChartContainerStyle}>{this.renderChart(chartKey, true)}</div>;
  }

  private renderChart(chartKey: string, isExpanded: boolean = false) {
    const chart = this.state.charts[chartKey];
    if (!chart || !chart.metrics) {
      return undefined;
    }
    const props: any = {
      key: chartKey,
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

export default ServiceMetrics;

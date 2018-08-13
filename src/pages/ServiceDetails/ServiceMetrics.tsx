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

type ServiceMetricsState = {
  alertDetails?: string;
  requestCountIn?: MetricGroup;
  requestCountOut?: MetricGroup;
  requestSizeIn?: Histogram;
  requestSizeOut?: Histogram;
  requestDurationIn?: Histogram;
  requestDurationOut?: Histogram;
  responseSizeIn?: Histogram;
  responseSizeOut?: Histogram;
  tcpReceivedIn?: MetricGroup;
  tcpReceivedOut?: MetricGroup;
  tcpSentIn?: MetricGroup;
  tcpSentOut?: MetricGroup;
  grafanaLink?: string;
  pollMetrics?: number;
};

const chartDefinitions = {
  requestCountIn: { familyName: 'Request volume (ops)', isInput: true, component: MetricChart },
  requestDurationIn: { familyName: 'Request duration (seconds)', isInput: true, component: HistogramChart },
  requestSizeIn: { familyName: 'Request size (bytes)', isInput: true, component: HistogramChart },
  responseSizeIn: { familyName: 'Response size (bytes)', isInput: true, component: HistogramChart },
  tcpReceivedIn: { familyName: 'TCP received (bps)', isInput: true, component: MetricChart },
  tcpSentIn: { familyName: 'TCP sent (bps)', isInput: true, component: MetricChart },
  requestCountOut: { familyName: 'Request volume (ops)', isInput: false, component: MetricChart },
  requestDurationOut: { familyName: 'Request duration (seconds)', isInput: false, component: HistogramChart },
  requestSizeOut: { familyName: 'Request size (bytes)', isInput: false, component: HistogramChart },
  responseSizeOut: { familyName: 'Response size (bytes)', isInput: false, component: HistogramChart },
  tcpSentOut: { familyName: 'TCP sent (bps)', isInput: false, component: MetricChart },
  tcpReceivedOut: { familyName: 'TCP received (bps)', isInput: false, component: MetricChart }
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
    this.state = {};
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
        this.setState({
          requestCountIn: metrics.metrics['request_count_in'],
          requestCountOut: metrics.metrics['request_count_out'],
          requestSizeIn: metrics.histograms['request_size_in'],
          requestSizeOut: metrics.histograms['request_size_out'],
          requestDurationIn: metrics.histograms['request_duration_in'],
          requestDurationOut: metrics.histograms['request_duration_out'],
          responseSizeIn: metrics.histograms['response_size_in'],
          responseSizeOut: metrics.histograms['response_size_out'],
          tcpReceivedIn: metrics.metrics['tcp_received_in'],
          tcpReceivedOut: metrics.metrics['tcp_received_out'],
          tcpSentIn: metrics.metrics['tcp_sent_in'],
          tcpSentOut: metrics.metrics['tcp_sent_out']
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
          <div className="col-xs-6">
            <div className="card-pf-accented card-pf-aggregate-status">
              <h3 className="card-pf-title">
                <span className="fa fa-bar-chart" />
                Input
              </h3>
              <div className="card-pf-body">
                {Object.keys(chartDefinitions).map(
                  chartKey => chartDefinitions[chartKey].isInput && this.renderNormalChart(chartKey)
                )}
              </div>
            </div>
          </div>
          <div className="col-xs-6">
            <div className="card-pf-accented card-pf-aggregate-status">
              <h3 className="card-pf-title">
                <span className="fa fa-bar-chart" />
                Output
              </h3>
              <ul className="card-pf-body">
                {Object.keys(chartDefinitions).map(
                  chartKey => !chartDefinitions[chartKey].isInput && this.renderNormalChart(chartKey)
                )}
              </ul>
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
    if (!this.state[chartKey]) {
      return null;
    }

    const metricDefinition = chartDefinitions[chartKey];
    let familyName = metricDefinition.familyName;
    if (isExpanded) {
      familyName = (metricDefinition.isInput ? 'Input: ' : 'Output: ') + familyName;
    }
    let props: any = {
      key: chartKey,
      series: this.state[chartKey].matrix,
      histogram: this.state[chartKey],
      familyName: familyName
    };

    if (!isExpanded) {
      props.onExpandRequested = () => this.onExpandHandler(chartKey);
    }

    return React.createElement(metricDefinition.component, props);
  }

  private onExpandHandler = (chartKey: string): void => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set('expand', chartKey);

    history.push(history.location.pathname + '?' + urlParams.toString());
  };
}

export default ServiceMetrics;

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
  grafanaLinkIn?: string;
  grafanaLinkOut?: string;
  pollMetrics?: number;
};

const chartDefinitions = {
  requestCountIn: { familyName: 'Request volume (ops)', isInput: true, component: MetricChart },
  requestDurationIn: { familyName: 'Request duration (seconds)', isInput: true, component: HistogramChart },
  requestSizeIn: { familyName: 'Request size (bytes)', isInput: true, component: HistogramChart },
  responseSizeIn: { familyName: 'Response size (bytes)', isInput: true, component: HistogramChart },
  requestCountOut: { familyName: 'Request volume (ops)', isInput: false, component: MetricChart },
  requestDurationOut: { familyName: 'Request duration (seconds)', isInput: false, component: HistogramChart },
  requestSizeOut: { familyName: 'Request size (bytes)', isInput: false, component: HistogramChart },
  responseSizeOut: { familyName: 'Response size (bytes)', isInput: false, component: HistogramChart }
};

class ServiceMetrics extends React.Component<ServiceId, ServiceMetricsState> {
  options: MetricsOptions;

  constructor(props: ServiceId) {
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
    options.filters = ['request_count', 'request_size', 'request_duration', 'response_size'];
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
          responseSizeOut: metrics.histograms['response_size_out']
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
            grafanaLinkIn: this.getGrafanaLink(info, false),
            grafanaLinkOut: this.getGrafanaLink(info, true)
          });
        } else {
          this.setState({ grafanaLinkIn: undefined, grafanaLinkOut: undefined });
        }
      })
      .catch(error => {
        this.setState({
          grafanaLinkIn: undefined,
          grafanaLinkOut: undefined
        });
        console.error(error);
      });
  }

  getGrafanaLink(info: GrafanaInfo, isSource: boolean): string {
    const varName = isSource ? info.varServiceSource : info.varServiceDest;
    return `${info.url}/dashboard/db/${info.dashboard}?${varName}=${this.props.service}.${this.props.namespace}.${
      info.variablesSuffix
    }`;
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
              {this.state.grafanaLinkIn && (
                <span id="grafana-in-link">
                  <a href={this.state.grafanaLinkIn} target="_blank">
                    View in Grafana
                  </a>
                </span>
              )}
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
              {this.state.grafanaLinkOut && (
                <span id="grafana-out-link">
                  <a href={this.state.grafanaLinkOut} target="_blank">
                    View in Grafana
                  </a>
                </span>
              )}
            </div>
          </div>
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

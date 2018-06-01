import * as React from 'react';
import { Alert } from 'patternfly-react';
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
          grafanaLinkOut: undefined,
          alertDetails: API.getErrorMsg('Cannot retrieve Grafana info.', error)
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
    return (
      <div>
        {this.state.alertDetails && <Alert onDismiss={this.dismissAlert}>{this.state.alertDetails}</Alert>}
        <MetricsOptionsBar
          onOptionsChanged={this.onOptionsChanged}
          onPollIntervalChanged={this.onPollIntervalChanged}
          onManualRefresh={this.fetchMetrics}
        />
        {this.renderMetrics()}
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
                {this.state.requestCountIn && (
                  <MetricChart series={this.state.requestCountIn.matrix} familyName="Request volume (ops)" />
                )}
                {this.state.requestDurationIn && (
                  <HistogramChart histogram={this.state.requestDurationIn} familyName="Request duration (seconds)" />
                )}
                {this.state.requestSizeIn && (
                  <HistogramChart histogram={this.state.requestSizeIn} familyName="Request size (bytes)" />
                )}
                {this.state.responseSizeIn && (
                  <HistogramChart histogram={this.state.responseSizeIn} familyName="Response size (bytes)" />
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
                {this.state.requestCountOut && (
                  <MetricChart series={this.state.requestCountOut.matrix} familyName="Request volume (ops)" />
                )}
                {this.state.requestDurationOut && (
                  <HistogramChart histogram={this.state.requestDurationOut} familyName="Request duration (seconds)" />
                )}
                {this.state.requestSizeOut && (
                  <HistogramChart histogram={this.state.requestSizeOut} familyName="Request size (bytes)" />
                )}
                {this.state.responseSizeOut && (
                  <HistogramChart histogram={this.state.responseSizeOut} familyName="Response size (bytes)" />
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
}

export default ServiceMetrics;

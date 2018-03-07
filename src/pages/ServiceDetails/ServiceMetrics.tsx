import * as React from 'react';
import ServiceId from '../../types/ServiceId';
import * as M from '../../types/Metrics';
import * as API from '../../services/Api';

interface GrafanaInfo {
  url: string;
  variablesSuffix: string;
  dashboard: string;
  varServiceSource: string;
  varServiceDest: string;
}

type ServiceMetricsState = {
  rateInterval: string;
  loading: boolean;
  delayedLoading: boolean;
  requestCountIn?: M.MetricGroup;
  requestCountOut?: M.MetricGroup;
  requestSizeIn?: M.Histogram;
  requestSizeOut?: M.Histogram;
  requestDurationIn?: M.Histogram;
  requestDurationOut?: M.Histogram;
  responseSizeIn?: M.Histogram;
  responseSizeOut?: M.Histogram;
  health?: M.Health;
  grafanaInfo?: GrafanaInfo;
};

class ServiceMetrics extends React.Component<ServiceId, ServiceMetricsState> {
  constructor(props: ServiceId) {
    super(props);
    this.state = {
      rateInterval: '5m',
      loading: false,
      delayedLoading: false
    };
    this.onRateIntervalChanged = this.onRateIntervalChanged.bind(this);
  }

  componentDidMount() {
    this.fetchMetrics();
    this.getGrafanaInfo();
  }

  onRateIntervalChanged(event: React.FormEvent<HTMLSelectElement>) {
    this.setState({ rateInterval: event.currentTarget.value }, () => {
      this.fetchMetrics();
    });
  }

  render() {
    return (
      <div>
        {this.renderRateInterval()}
        {this.renderMetrics()}
      </div>
    );
  }

  renderRateInterval() {
    return (
      <div>
        Rate interval:
        <select value={this.state.rateInterval} onChange={this.onRateIntervalChanged}>
          <option value="1m">1 minute</option>
          <option value="5m">5 minutes</option>
          <option value="10m">10 minutes</option>
          <option value="30m">30 minutes</option>
          <option value="1h">1 hour</option>
          <option value="3h">3 hours</option>
          <option value="6h">6 hours</option>
          <option value="12h">12 hours</option>
          <option value="1d">1 day</option>
        </select>
      </div>
    );
  }

  renderMetrics() {
    if (this.state.loading && this.state.delayedLoading) {
      return <div className="spinner spinner-sm left-spinner" />;
    } else {
      return (
        <div className="card-pf">
          <div className="row row-cards-pf">
            <div className="col-xs-4">
              <div className="card-pf-accented card-pf-aggregate-status">
                <div className="card-pf-title">
                  <span className="fa fa-heart" />
                  Health
                </div>
                <div className="card-pf-body">{this.health()}</div>
              </div>
            </div>
            <div className="col-xs-4">
              <div className="card-pf-accented card-pf-aggregate-status">
                <h3 className="card-pf-title">
                  <span className="fa fa-bar-chart" />
                  Input
                </h3>
                <ul className="card-pf-body">
                  <li>Request count rate: {this.metricToString(this.state.requestCountIn)}</li>
                  <li>Request size: {this.histogramToString(this.state.requestSizeIn)}</li>
                  <li>Request duration: {this.histogramToString(this.state.requestDurationIn)}</li>
                  <li>Response size: {this.histogramToString(this.state.responseSizeIn)}</li>
                </ul>
                {this.renderGrafanaLink(false)}
              </div>
            </div>
            <div className="col-xs-4">
              <div className="card-pf-accented card-pf-aggregate-status">
                <h3 className="card-pf-title">
                  <span className="fa fa-bar-chart" />
                  Output
                </h3>
                <ul className="card-pf-body">
                  <li>Request count rate: {this.metricToString(this.state.requestCountOut)}</li>
                  <li>Request size: {this.histogramToString(this.state.requestSizeOut)}</li>
                  <li>Request duration: {this.histogramToString(this.state.requestDurationOut)}</li>
                  <li>Response size: {this.histogramToString(this.state.responseSizeOut)}</li>
                </ul>
                {this.renderGrafanaLink(true)}
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  renderGrafanaLink(isSource: boolean) {
    if (this.state.grafanaInfo) {
      const varName = isSource ? this.state.grafanaInfo.varServiceSource : this.state.grafanaInfo.varServiceDest;
      const link = `${this.state.grafanaInfo.url}/dashboard/db/${this.state.grafanaInfo.dashboard}?${varName}=${
        this.props.service
      }.${this.props.namespace}.${this.state.grafanaInfo.variablesSuffix}`;
      return <a href={link}>View in Grafana</a>;
    }
    return null;
  }

  fetchMetrics() {
    this.setState({ loading: true, delayedLoading: false });
    setTimeout(() => {
      // This will show spinner only after 0.1s of loading to avoid blinking effect on fast response
      this.setState({ delayedLoading: true });
    }, 100);
    API.getServiceMetrics(this.props.namespace, this.props.service, { rateInterval: this.state.rateInterval })
      .then(response => {
        const metrics: M.Metrics = response['data'];
        this.setState({
          loading: false,
          requestCountIn: metrics.metrics['request_count_in'],
          requestCountOut: metrics.metrics['request_count_out'],
          requestSizeIn: metrics.histograms['request_size_in'],
          requestSizeOut: metrics.histograms['request_size_out'],
          requestDurationIn: metrics.histograms['request_duration_in'],
          requestDurationOut: metrics.histograms['request_duration_out'],
          responseSizeIn: metrics.histograms['response_size_in'],
          responseSizeOut: metrics.histograms['response_size_out'],
          health: metrics.health
        });
      })
      .catch(error => {
        this.setState({ loading: false });
        console.error(error);
      });
  }

  getGrafanaInfo() {
    API.getGrafanaInfo()
      .then(response => {
        if (response['data']) {
          this.setState({ grafanaInfo: response['data'] });
        } else {
          this.setState({ grafanaInfo: undefined });
        }
      })
      .catch(error => {
        this.setState({ grafanaInfo: undefined });
        console.error(error);
      });
  }

  health() {
    if (this.state.health) {
      return this.round(100 * this.state.health.healthyReplicas / this.state.health.totalReplicas) + ' %';
    }
    return 'n/a';
  }

  metricToString(group?: M.MetricGroup): string {
    if (group && group.matrix.length > 0 && group.matrix[0].values.length > 0) {
      const dp = group.matrix[0].values[group.matrix[0].values.length - 1];
      return String(this.round(dp[1]));
    }
    return 'n/a';
  }

  histogramToString(hist?: M.Histogram): string {
    if (hist) {
      return `avg: ${this.metricToString(hist.average)}; med: ${this.metricToString(hist.median)}; 95th:
        ${this.metricToString(hist.percentile95)}; 99th: ${this.metricToString(hist.percentile99)}`;
    }
    return 'n/a';
  }

  round(val: number): number {
    // 2 decimal digits
    return Math.round(val * 100) / 100;
  }
}

export default ServiceMetrics;

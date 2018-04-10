import * as React from 'react';
import { Alert, LineChart } from 'patternfly-react';

import ServiceId from '../../types/ServiceId';
import * as M from '../../types/Metrics';
import * as API from '../../services/Api';
import MetricsOptionsBar from '../../components/MetricsOptions/MetricsOptionsBar';
import MetricsOptions from '../../types/MetricsOptions';
import graphUtils from '../../utils/graphing';

interface GrafanaInfo {
  url: string;
  variablesSuffix: string;
  dashboard: string;
  varServiceSource: string;
  varServiceDest: string;
}

type ServiceMetricsState = {
  loading: boolean;
  alertDetails?: string;
  requestCountIn?: M.MetricGroup;
  requestCountOut?: M.MetricGroup;
  requestSizeIn?: M.Histogram;
  requestSizeOut?: M.Histogram;
  requestDurationIn?: M.Histogram;
  requestDurationOut?: M.Histogram;
  responseSizeIn?: M.Histogram;
  responseSizeOut?: M.Histogram;
  grafanaLinkIn?: string;
  grafanaLinkOut?: string;
  pollMetrics?: any;
};

class ServiceMetrics extends React.Component<ServiceId, ServiceMetricsState> {
  constructor(props: ServiceId) {
    super(props);
    this.state = {
      loading: false
    };
  }

  componentDidMount() {
    this.getGrafanaInfo();
  }

  onOptionsChanged = (options: MetricsOptions, pollInterval: number) => {
    clearInterval(this.state.pollMetrics);
    this.fetchMetrics(options);
    if (pollInterval !== undefined) {
      if (pollInterval > 0) {
        this.setState({ pollMetrics: setInterval(this.fetchMetrics, pollInterval, options) });
      }
    }
  };

  fetchMetrics = (options: MetricsOptions) => {
    options.filters = ['request_count', 'request_size', 'request_duration', 'response_size'];
    this.setState({ loading: true });
    API.getServiceMetrics(this.props.namespace, this.props.service, options)
      .then(response => {
        const metrics: M.Metrics = response['data'];
        this.setState({
          loading: false,
          requestCountIn: this.nameMetric(
            metrics.metrics['request_count_in'],
            'Request volume (ops)',
            options.byLabelsIn
          ),
          requestCountOut: this.nameMetric(
            metrics.metrics['request_count_out'],
            'Request volume (ops)',
            options.byLabelsOut
          ),
          requestSizeIn: this.nameHistogram(
            metrics.histograms['request_size_in'],
            'Request size (bytes)',
            options.byLabelsIn
          ),
          requestSizeOut: this.nameHistogram(
            metrics.histograms['request_size_out'],
            'Request size (bytes)',
            options.byLabelsOut
          ),
          requestDurationIn: this.nameHistogram(
            metrics.histograms['request_duration_in'],
            'Request duration (seconds)',
            options.byLabelsIn
          ),
          requestDurationOut: this.nameHistogram(
            metrics.histograms['request_duration_out'],
            'Request duration (seconds)',
            options.byLabelsOut
          ),
          responseSizeIn: this.nameHistogram(
            metrics.histograms['response_size_in'],
            'Response size (bytes)',
            options.byLabelsIn
          ),
          responseSizeOut: this.nameHistogram(
            metrics.histograms['response_size_out'],
            'Response size (bytes)',
            options.byLabelsOut
          )
        });
      })
      .catch(error => {
        this.setState({ loading: false, alertDetails: API.GetErrorMsg('Cannot fetch metrics.', error) });
        console.error(error);
      });
  };

  nameMetric(metric: M.MetricGroup, familyName: string, labels?: string[]): M.MetricGroup {
    if (metric) {
      metric.familyName = familyName;
      metric.matrix.forEach(ts => {
        if (labels === undefined || labels.length === 0) {
          ts.name = familyName;
        } else {
          const strLabels = labels.map(lbl => ts.metric[lbl]).join(',');
          ts.name = `${familyName}{${strLabels}}`;
        }
      });
    }
    return metric;
  }

  nameHistogram(histo: M.Histogram, familyName: string, labels?: string[]): M.Histogram {
    if (histo) {
      histo.familyName = familyName;
      histo.average = this.nameMetric(histo.average, familyName + '[avg]', labels);
      histo.median = this.nameMetric(histo.median, familyName + '[med]', labels);
      histo.percentile95 = this.nameMetric(histo.percentile95, familyName + '[p95]', labels);
      histo.percentile99 = this.nameMetric(histo.percentile99, familyName + '[p99]', labels);
    }
    return histo;
  }

  getGrafanaInfo() {
    API.getGrafanaInfo()
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
          alertDetails: API.GetErrorMsg('Cannot retrieve Grafana info.', error)
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

  round(val: number): number {
    // 2 decimal digits
    return Math.round(val * 100) / 100;
  }

  dismissAlert = () => this.setState({ alertDetails: undefined });

  render() {
    return (
      <div>
        {this.state.alertDetails && <Alert onDismiss={this.dismissAlert}>{this.state.alertDetails}</Alert>}
        <MetricsOptionsBar onOptionsChanged={this.onOptionsChanged} loading={this.state.loading} />
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
                {this.renderMetric('requestCountIn', this.state.requestCountIn)}
                {this.renderHistogram('requestSizeIn', this.state.requestSizeIn)}
                {this.renderHistogram('requestDurationIn', this.state.requestDurationIn)}
                {this.renderHistogram('responseSizeIn', this.state.responseSizeIn)}
              </div>
              {this.state.grafanaLinkIn && (
                <span id="grafana-in-link">
                  <a href={this.state.grafanaLinkIn}>View in Grafana</a>
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
                {this.renderMetric('requestCountOut', this.state.requestCountOut)}
                {this.renderHistogram('requestSizeOut', this.state.requestSizeOut)}
                {this.renderHistogram('requestDurationOut', this.state.requestDurationOut)}
                {this.renderHistogram('responseSizeOut', this.state.responseSizeOut)}
              </ul>
              {this.state.grafanaLinkOut && (
                <span id="grafana-out-link">
                  <a href={this.state.grafanaLinkOut}>View in Grafana</a>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  renderMetric(id: string, metric?: M.MetricGroup) {
    if (metric) {
      return this.renderChart(id, metric.familyName, graphUtils.toC3Columns(metric.matrix));
    }
    return <div />;
  }

  renderHistogram(id: string, histo?: M.Histogram) {
    if (histo) {
      const columns = graphUtils
        .toC3Columns(histo.average.matrix)
        .concat(graphUtils.toC3Columns(histo.median.matrix))
        .concat(graphUtils.toC3Columns(histo.percentile95.matrix))
        .concat(graphUtils.toC3Columns(histo.percentile99.matrix));
      return this.renderChart(id, histo.familyName, columns);
    }
    return <div />;
  }

  renderChart(id: string, title: string, columns: [string, number][]) {
    const data = {
      x: 'x',
      columns: columns
    };
    const axis = {
      x: {
        type: 'timeseries',
        tick: {
          fit: true,
          count: 15,
          multiline: false,
          format: '%H:%M:%S'
        }
      }
    };
    return <LineChart id={id} title={{ text: title }} data={data} axis={axis} point={{ show: false }} />;
  }
}

export default ServiceMetrics;

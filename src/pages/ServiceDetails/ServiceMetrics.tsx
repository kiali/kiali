import * as React from 'react';
import { Alert, LineChart } from 'patternfly-react';

import ServiceId from '../../types/ServiceId';
import * as M from '../../types/Metrics';
import GrafanaInfo from '../../types/GrafanaInfo';
import * as API from '../../services/Api';
import { computePrometheusQueryInterval } from '../../services/Prometheus';
import MetricsOptionsBar from '../../components/MetricsOptions/MetricsOptionsBar';
import MetricsOptions from '../../types/MetricsOptions';
import graphUtils from '../../utils/Graphing';

type ServiceMetricsState = {
  loading: boolean;
  alertDetails?: string;
  requestCountIn?: NamedMetric;
  requestCountOut?: NamedMetric;
  requestSizeIn?: NamedHistogram;
  requestSizeOut?: NamedHistogram;
  requestDurationIn?: NamedHistogram;
  requestDurationOut?: NamedHistogram;
  responseSizeIn?: NamedHistogram;
  responseSizeOut?: NamedHistogram;
  grafanaLinkIn?: string;
  grafanaLinkOut?: string;
  pollMetrics?: number;
};

type NamedMetric = {
  id: string;
  familyName: string;
  matrix: M.TimeSeries[];
};

type NamedHistogram = {
  id: string;
  familyName: string;
  average: NamedMetric;
  median: NamedMetric;
  percentile95: NamedMetric;
  percentile99: NamedMetric;
};

class ServiceMetrics extends React.Component<ServiceId, ServiceMetricsState> {
  options: MetricsOptions;

  constructor(props: ServiceId) {
    super(props);
    this.state = {
      loading: false
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

  onManualRefresh = () => (this.state.loading ? null : this.fetchMetrics());

  fetchMetrics = () => {
    this.setState({ loading: true });
    API.getServiceMetrics(this.props.namespace, this.props.service, this.options)
      .then(response => {
        const metrics: M.Metrics = response.data;
        this.setState({
          loading: false,
          requestCountIn: this.nameMetric(
            metrics.metrics['request_count_in'],
            'Request volume (ops)',
            this.options.byLabelsIn
          ),
          requestCountOut: this.nameMetric(
            metrics.metrics['request_count_out'],
            'Request volume (ops)',
            this.options.byLabelsOut
          ),
          requestSizeIn: this.nameHistogram(
            metrics.histograms['request_size_in'],
            'Request size (bytes)',
            this.options.byLabelsIn
          ),
          requestSizeOut: this.nameHistogram(
            metrics.histograms['request_size_out'],
            'Request size (bytes)',
            this.options.byLabelsOut
          ),
          requestDurationIn: this.nameHistogram(
            metrics.histograms['request_duration_in'],
            'Request duration (seconds)',
            this.options.byLabelsIn
          ),
          requestDurationOut: this.nameHistogram(
            metrics.histograms['request_duration_out'],
            'Request duration (seconds)',
            this.options.byLabelsOut
          ),
          responseSizeIn: this.nameHistogram(
            metrics.histograms['response_size_in'],
            'Response size (bytes)',
            this.options.byLabelsIn
          ),
          responseSizeOut: this.nameHistogram(
            metrics.histograms['response_size_out'],
            'Response size (bytes)',
            this.options.byLabelsOut
          )
        });
      })
      .catch(error => {
        this.setState({ loading: false, alertDetails: API.getErrorMsg('Cannot fetch metrics.', error) });
        console.error(error);
      });
  };

  nameMetric(metric: M.MetricGroup, familyName: string, labels?: string[]): NamedMetric | undefined {
    if (metric) {
      let id = familyName;
      if (labels && labels.length > 0) {
        id += '-' + labels.join('-');
      }
      metric.matrix.forEach(ts => {
        if (labels === undefined || labels.length === 0) {
          ts.name = familyName;
        } else {
          const strLabels = labels.map(lbl => ts.metric[lbl]).join(',');
          ts.name = `${familyName}{${strLabels}}`;
        }
      });
      return {
        id: id,
        familyName: familyName,
        matrix: metric.matrix
      };
    }
    return undefined;
  }

  nameHistogram(histo: M.Histogram, familyName: string, labels?: string[]): NamedHistogram | undefined {
    if (histo) {
      let id = familyName;
      if (labels) {
        id += '-' + labels.join('-');
      }
      const average = this.nameMetric(histo.average, familyName + '[avg]', labels);
      const median = this.nameMetric(histo.median, familyName + '[med]', labels);
      const percentile95 = this.nameMetric(histo.percentile95, familyName + '[p95]', labels);
      const percentile99 = this.nameMetric(histo.percentile99, familyName + '[p99]', labels);
      return {
        id: id,
        familyName: familyName,
        average: average!,
        median: median!,
        percentile95: percentile95!,
        percentile99: percentile99!
      };
    }
    return undefined;
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

  round(val: number): number {
    // 2 decimal digits
    return Math.round(val * 100) / 100;
  }

  dismissAlert = () => this.setState({ alertDetails: undefined });

  render() {
    return (
      <div>
        {this.state.alertDetails && <Alert onDismiss={this.dismissAlert}>{this.state.alertDetails}</Alert>}
        <MetricsOptionsBar
          onOptionsChanged={this.onOptionsChanged}
          onPollIntervalChanged={this.onPollIntervalChanged}
          onManualRefresh={this.onManualRefresh}
          loading={this.state.loading}
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
                {this.renderMetric(this.state.requestCountIn)}
                {this.renderHistogram(this.state.requestDurationIn)}
                {this.renderHistogram(this.state.requestSizeIn)}
                {this.renderHistogram(this.state.responseSizeIn)}
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
                {this.renderMetric(this.state.requestCountOut)}
                {this.renderHistogram(this.state.requestDurationOut)}
                {this.renderHistogram(this.state.requestSizeOut)}
                {this.renderHistogram(this.state.responseSizeOut)}
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

  renderMetric(metric?: NamedMetric) {
    if (metric) {
      return this.renderChart(metric.id, metric.familyName, graphUtils.toC3Columns(metric.matrix));
    }
    return <div />;
  }

  renderHistogram(histo?: NamedHistogram) {
    if (histo) {
      const columns = graphUtils
        .toC3Columns(histo.average.matrix)
        .concat(graphUtils.toC3Columns(histo.median.matrix))
        .concat(graphUtils.toC3Columns(histo.percentile95.matrix))
        .concat(graphUtils.toC3Columns(histo.percentile99.matrix));
      return this.renderChart(histo.id, histo.familyName, columns);
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
      },
      y: {
        tick: {
          format: val => {
            // parseFloat is used to remove trailing zeros
            return parseFloat(val.toFixed(5));
          }
        }
      }
    };
    return (
      <span key={id}>
        <LineChart id={id} title={{ text: title }} data={data} axis={axis} point={{ show: false }} />
      </span>
    );
  }
}

export default ServiceMetrics;

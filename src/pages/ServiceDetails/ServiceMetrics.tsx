import * as React from 'react';
import { Spinner, LineChart, DonutChart } from 'patternfly-react';

import ServiceId from '../../types/ServiceId';
import * as M from '../../types/Metrics';
import Health from '../../types/Health';
import * as API from '../../services/Api';
import MetricsOptionsBar from '../../components/MetricsOptions/MetricsOptionsBar';
import MetricsOptions from '../../types/MetricsOptions';

interface GrafanaInfo {
  url: string;
  variablesSuffix: string;
  dashboard: string;
  varServiceSource: string;
  varServiceDest: string;
}

type ServiceMetricsState = {
  loading: boolean;
  requestCountIn?: M.MetricGroup;
  requestCountOut?: M.MetricGroup;
  requestSizeIn?: M.Histogram;
  requestSizeOut?: M.Histogram;
  requestDurationIn?: M.Histogram;
  requestDurationOut?: M.Histogram;
  responseSizeIn?: M.Histogram;
  responseSizeOut?: M.Histogram;
  health?: Health;
  grafanaLinkIn?: string;
  grafanaLinkOut?: string;
};

class ServiceMetrics extends React.Component<ServiceId, ServiceMetricsState> {
  // "Constants"
  healthDonutSize = {
    width: '200',
    height: '200'
  };
  healthDonutColors = {
    // From Patternfly status palette
    Healthy: '#3f9c35',
    Failure: '#cc0000'
  };

  constructor(props: ServiceId) {
    super(props);
    this.state = {
      loading: false
    };
    this.onOptionsChanged = this.onOptionsChanged.bind(this);
  }

  componentDidMount() {
    this.getGrafanaInfo();
    this.fetchHealth();
  }

  onOptionsChanged(options: MetricsOptions) {
    this.fetchMetrics(options);
  }

  fetchMetrics(options: MetricsOptions) {
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
        // TODO: show error alert
        this.setState({ loading: false });
        console.error(error);
      });
  }

  fetchHealth() {
    API.getServiceHealth(this.props.namespace, this.props.service)
      .then(response => {
        this.setState({
          health: response['data']
        });
      })
      .catch(error => {
        // TODO: show error alert
        console.error(error);
      });
  }

  nameMetric(metric: M.MetricGroup, familyName: string, labels: string[]): M.MetricGroup {
    if (metric) {
      metric.familyName = familyName;
      metric.matrix.forEach(ts => {
        if (labels.length === 0) {
          ts.name = familyName;
        } else {
          const strLabels = labels.map(lbl => ts.metric[lbl]).join(',');
          ts.name = `${familyName}{${strLabels}}`;
        }
      });
    }
    return metric;
  }

  nameHistogram(histo: M.Histogram, familyName: string, labels: string[]): M.Histogram {
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
        this.setState({ grafanaLinkIn: undefined, grafanaLinkOut: undefined });
        console.error(error);
      });
  }

  getGrafanaLink(info: GrafanaInfo, isSource: boolean): string {
    const varName = isSource ? info.varServiceSource : info.varServiceDest;
    return `${info.url}/dashboard/db/${info.dashboard}?${varName}=${this.props.service}.${this.props.namespace}.${
      info.variablesSuffix
    }`;
  }

  health() {
    if (this.state.health) {
      return {
        colors: this.healthDonutColors,
        columns: [
          ['Healthy', this.state.health.healthyReplicas],
          ['Failure', this.state.health.totalReplicas - this.state.health.healthyReplicas]
        ],
        type: 'donut'
      };
    }
    return null;
  }

  round(val: number): number {
    // 2 decimal digits
    return Math.round(val * 100) / 100;
  }

  render() {
    return (
      <div>
        <MetricsOptionsBar onOptionsChanged={this.onOptionsChanged} />
        {this.renderMetrics()}
      </div>
    );
  }

  renderMetrics() {
    if (this.state.loading) {
      return <Spinner loading={true} />;
    }
    return (
      <div className="card-pf">
        <div className="row row-cards-pf">
          <div className="col-xs-12">
            <div className="card-pf-accented card-pf-aggregate-status">
              <div className="card-pf-title">
                <span className="fa fa-heart" />
                Health
                {this.renderHealth()}
              </div>
            </div>
          </div>
        </div>
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

  renderHealth() {
    const health = this.health();
    if (health) {
      return (
        <DonutChart
          id={'health-donut'}
          size={this.healthDonutSize}
          data={health}
          title={{ type: 'percent' }}
          legend={{ show: false }}
        />
      );
    }
    // const data = {
    //   colors: { 'N/A': '#707070' },
    //   columns: [['N/A', 1]],
    //   type: 'donut'
    // };
    return <div />;
  }

  renderMetric(id: string, metric?: M.MetricGroup) {
    if (metric) {
      return this.renderChart(id, metric.familyName, this.toC3Columns(metric.matrix));
    }
    return <div />;
  }

  renderHistogram(id: string, histo?: M.Histogram) {
    if (histo) {
      const columns = this.toC3Columns(histo.average.matrix)
        .concat(this.toC3Columns(histo.median.matrix))
        .concat(this.toC3Columns(histo.percentile95.matrix))
        .concat(this.toC3Columns(histo.percentile99.matrix));
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

  toC3Columns(matrix: M.TimeSeries[]): [string, number][] {
    return matrix
      .map(mat => {
        let xseries: any = ['x'];
        return xseries.concat(mat.values.map(dp => dp[0] * 1000));
      })
      .concat(
        matrix.map(mat => {
          let yseries: any = [mat.name];
          return yseries.concat(mat.values.map(dp => dp[1]));
        })
      );
  }
}

export default ServiceMetrics;

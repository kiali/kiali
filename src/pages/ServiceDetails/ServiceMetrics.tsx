import * as React from 'react';
import ServiceId from '../../types/ServiceId';
import * as M from '../../types/Metrics';
import * as API from '../../services/Api';
import MetricsOptionsBar from '../../components/MetricsOptions/MetricsOptionsBar';
import { MetricsOptions } from '../../types/MetricsOptions';
import { Spinner, LineChart, DonutChart } from 'patternfly-react';

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
  health?: M.Health;
  grafanaInfo?: GrafanaInfo;
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
        // TODO: show error alert
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
                {this.renderMetric('requestCountIn', 'Request count rate', this.state.requestCountIn)}
                {this.renderHistogram('requestSizeIn', 'Request size', this.state.requestSizeIn)}
                {this.renderHistogram('requestDurationIn', 'Request duration', this.state.requestDurationIn)}
                {this.renderHistogram('responseSizeIn', 'Response size', this.state.responseSizeIn)}
              </div>
              {this.renderGrafanaLink(false)}
            </div>
          </div>
          <div className="col-xs-6">
            <div className="card-pf-accented card-pf-aggregate-status">
              <h3 className="card-pf-title">
                <span className="fa fa-bar-chart" />
                Output
              </h3>
              <ul className="card-pf-body">
                {this.renderMetric('requestCountOut', 'Request count rate', this.state.requestCountOut)}
                {this.renderHistogram('requestSizeOut', 'Request size', this.state.requestSizeOut)}
                {this.renderHistogram('requestDurationOut', 'Request duration', this.state.requestDurationOut)}
                {this.renderHistogram('responseSizeOut', 'Response size', this.state.responseSizeOut)}
              </ul>
              {this.renderGrafanaLink(true)}
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

  renderMetric(id: string, title: string, metric?: M.MetricGroup) {
    if (metric) {
      return this.renderChart(id, title, this.toC3Columns(metric.matrix, title));
    }
    return <div />;
  }

  renderHistogram(id: string, title: string, histo?: M.Histogram) {
    if (histo) {
      const columns = this.toC3Columns(histo.average.matrix, title + ' [avg]')
        .concat(this.toC3Columns(histo.median.matrix, title + ' [med]'))
        .concat(this.toC3Columns(histo.percentile95.matrix, title + ' [p95]'))
        .concat(this.toC3Columns(histo.percentile99.matrix, title + ' [p99]'));
      return this.renderChart(id, title, columns);
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

  toC3Columns(matrix: M.TimeSeries[], title: string): [string, number][] {
    return matrix
      .map(mat => {
        let xseries: any = ['x'];
        return xseries.concat(mat.values.map(dp => dp[0] * 1000));
      })
      .concat(
        matrix.map(mat => {
          let yseries: any = [title];
          return yseries.concat(mat.values.map(dp => dp[1]));
        })
      );
  }

  renderGrafanaLink(isSource: boolean) {
    if (this.state.grafanaInfo) {
      const varName = isSource ? this.state.grafanaInfo.varServiceSource : this.state.grafanaInfo.varServiceDest;
      const link = `${this.state.grafanaInfo.url}/dashboard/db/${this.state.grafanaInfo.dashboard}?${varName}=${
        this.props.service
      }.${this.props.namespace}.${this.state.grafanaInfo.variablesSuffix}`;
      return (
        <span id={'grafana-' + (isSource ? 'source' : 'destination') + '-link'}>
          <a href={link}>View in Grafana</a>
        </span>
      );
    }
    return null;
  }
}

export default ServiceMetrics;

import * as React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Icon } from 'patternfly-react';
import { style } from 'typestyle';

import history, { HistoryManager, URLParams } from '../../app/History';
import MetricsOptionsBar from '../MetricsOptions/MetricsOptionsBar';
import { MetricsLabels as L } from '../MetricsOptions/MetricsLabels';
import * as API from '../../services/Api';
import { computePrometheusQueryInterval } from '../../services/Prometheus';
import GrafanaInfo from '../../types/GrafanaInfo';
import * as M from '../../types/Metrics';
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
  sourceMetrics?: M.MetricGroup | M.Histogram;
  destMetrics?: M.MetricGroup | M.Histogram;
};

type ChartDefinitions = { [key: string]: ChartDefinition };

type MetricsState = {
  alertDetails?: string;
  grafanaLink?: string;
  metricReporter: string;
  chartDefs: ChartDefinitions;
  labelValues: Map<L.LabelName, L.LabelValues>;
};

type ObjectId = {
  namespace: string;
  object: string;
};

type MetricsProps = ObjectId & {
  isPageVisible?: boolean;
  objectType: M.MetricsObjectTypes;
  direction: M.MetricsDirection;
};

class Metrics extends React.Component<MetricsProps, MetricsState> {
  static defaultProps = {
    isPageVisible: true
  };

  options: MetricsOptions;

  private static isHistogram(chart: ChartDefinition): boolean {
    return chart.component === HistogramChart;
  }

  constructor(props: MetricsProps) {
    super(props);

    let metricReporter = 'source';

    const metricReporterParam = HistoryManager.getParam(URLParams.REPORTER);
    if (metricReporterParam != null) {
      metricReporter = metricReporterParam;
    } else if (this.props.direction === M.MetricsDirection.INBOUND) {
      metricReporter = 'destination';
    }

    this.state = {
      metricReporter: metricReporter,
      chartDefs: this.getChartsDef(),
      labelValues: new Map()
    };
  }

  getChartsDef(): ChartDefinitions {
    let inboundCharts = {
      request_count_in: { name: 'Request volume', unit: 'ops', component: MetricChart },
      request_duration_in: { name: 'Request duration', unit: 's', component: HistogramChart },
      request_size_in: { name: 'Request size', unit: 'B', component: HistogramChart },
      response_size_in: { name: 'Response size', unit: 'B', component: HistogramChart },
      tcp_received_in: { name: 'TCP received', unit: 'bps', component: MetricChart },
      tcp_sent_in: { name: 'TCP sent', unit: 'bps', component: MetricChart }
    };
    let charts: ChartDefinitions = inboundCharts;

    if (this.props.direction === M.MetricsDirection.OUTBOUND) {
      charts = {
        request_count_out: { name: 'Request volume', unit: 'ops', component: MetricChart },
        request_duration_out: { name: 'Request duration', unit: 's', component: HistogramChart },
        request_size_out: { name: 'Request size', unit: 'B', component: HistogramChart },
        response_size_out: { name: 'Response size', unit: 'B', component: HistogramChart },
        tcp_received_out: { name: 'TCP received', unit: 'bps', component: MetricChart },
        tcp_sent_out: { name: 'TCP sent', unit: 'bps', component: MetricChart }
      };
    }

    return charts;
  }

  fillChartsMetrics(charts: ChartDefinitions, metricsData: M.Metrics) {
    Object.keys(charts).forEach(k => {
      const chart = charts[k];
      if (Metrics.isHistogram(chart)) {
        chart.sourceMetrics = metricsData.source.histograms[k];
        chart.destMetrics = metricsData.dest.histograms[k];
      } else {
        chart.sourceMetrics = metricsData.source.metrics[k];
        chart.destMetrics = metricsData.dest.metrics[k];
      }
    });
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
    const labelValues = this.extractLabelValues(this.state.chartDefs, reporter);
    this.setState({
      metricReporter: reporter,
      labelValues: labelValues
    });
  };

  fetchMetrics = () => {
    let promise: Promise<API.Response<M.Metrics>>;
    switch (this.props.objectType) {
      case M.MetricsObjectTypes.WORKLOAD:
        promise = API.getWorkloadMetrics(authentication(), this.props.namespace, this.props.object, this.options);
        break;
      case M.MetricsObjectTypes.APP:
        promise = API.getAppMetrics(authentication(), this.props.namespace, this.props.object, this.options);
        break;
      case M.MetricsObjectTypes.SERVICE:
      default:
        promise = API.getServiceMetrics(authentication(), this.props.namespace, this.props.object, this.options);
        break;
    }
    promise
      .then(response => {
        const chartDefs = this.getChartsDef();
        this.fillChartsMetrics(chartDefs, response.data);
        const labelValues = this.extractLabelValues(chartDefs, this.state.metricReporter);
        this.setState({
          chartDefs: chartDefs,
          labelValues: labelValues
        });
      })
      .catch(error => {
        this.setState({ alertDetails: API.getErrorMsg('Cannot fetch metrics.', error) });
        console.error(error);
      });
  };

  extractLabelValues(chartDefs: ChartDefinitions, reporter: string): Map<L.LabelName, L.LabelValues> {
    // Find all labels on all series
    const labelsWithValues: Map<L.LabelName, L.LabelValues> = new Map();
    const labelGroups =
      this.props.direction === M.MetricsDirection.OUTBOUND ? L.REVERSE_OUTBOUND_LABELS : L.REVERSE_INBOUND_LABELS;
    const chartMetrics =
      reporter === 'source'
        ? (chartDef: ChartDefinition) => chartDef.sourceMetrics
        : (chartDef: ChartDefinition) => chartDef.destMetrics;
    for (let name in chartDefs) {
      if (chartDefs.hasOwnProperty(name)) {
        const chartDef = chartDefs[name];
        const metrics = chartMetrics(chartDef);
        if (metrics) {
          if (Metrics.isHistogram(chartDef)) {
            Object.keys(metrics).forEach(stat => {
              this.extractLabelValuesOnSeries(metrics[stat].matrix, labelGroups, labelsWithValues);
            });
          } else {
            this.extractLabelValuesOnSeries((metrics as M.MetricGroup).matrix, labelGroups, labelsWithValues);
          }
        }
      }
    }
    // Keep existing show flag
    labelsWithValues.forEach((values: L.LabelValues, key: L.LabelName) => {
      const previous = this.state.labelValues.get(key);
      if (previous) {
        Object.keys(values).forEach(k => {
          if (previous.hasOwnProperty(k)) {
            values[k] = previous[k];
          }
        });
      }
    });
    return labelsWithValues;
  }

  getGrafanaLink(info: GrafanaInfo): string {
    let grafanaLink;
    switch (this.props.objectType) {
      case M.MetricsObjectTypes.SERVICE:
        grafanaLink = `${info.url}${info.serviceDashboardPath}?${info.varService}=${this.props.object}.${
          this.props.namespace
        }.svc.cluster.local`;
        break;
      case M.MetricsObjectTypes.WORKLOAD:
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

  onLabelsFiltersChanged = (labelValues: Map<L.LabelName, L.LabelValues>) => {
    this.setState({ labelValues: labelValues });
  };

  render() {
    if (!this.props.isPageVisible) {
      return null;
    }

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
          onLabelsFiltersChanged={this.onLabelsFiltersChanged}
          metricReporter={this.state.metricReporter}
          direction={this.props.direction}
          labelValues={this.state.labelValues}
        />
        {expandedChart ? this.renderExpandedChart(expandedChart) : this.renderMetrics()}
      </div>
    );
  }

  renderMetrics() {
    const charts = this.state.chartDefs;
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
    const charts = this.state.chartDefs;
    return <div className={expandedChartContainerStyle}>{this.renderChart(chartKey, charts[chartKey], true)}</div>;
  }

  private convertAsPromLabels(labels: Map<L.LabelName, L.LabelValues>): Map<L.PromLabel, L.LabelValues> {
    const promLabels = new Map<L.PromLabel, L.LabelValues>();
    const labelGroups = this.props.direction === M.MetricsDirection.OUTBOUND ? L.OUTBOUND_LABELS : L.INBOUND_LABELS;
    labels.forEach((val, k) => {
      const promName = labelGroups.get(k);
      if (promName) {
        promLabels.set(promName, val);
      }
    });
    return promLabels;
  }

  private renderChart(chartKey: string, chart: ChartDefinition, isExpanded: boolean = false) {
    if (!chart) {
      return undefined;
    }
    const data = this.state.metricReporter === 'destination' ? chart.destMetrics : chart.sourceMetrics;
    if (!data) {
      return undefined;
    }
    const props: any = {
      key: chartKey + this.state.metricReporter,
      chartName: chart.name,
      labelValues: this.convertAsPromLabels(this.state.labelValues),
      unit: chart.unit
    };
    if (Metrics.isHistogram(chart)) {
      props.histogram = data;
    } else {
      props.series = (data as M.MetricGroup).matrix;
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

  private extractLabelValuesOnSeries(
    series: M.TimeSeries[],
    labelGroups: Map<L.PromLabel, L.LabelName>,
    extracted: Map<L.LabelName, L.LabelValues>
  ): void {
    series.forEach(ts => {
      Object.keys(ts.metric).forEach(k => {
        const labelGroup = labelGroups.get(k);
        if (labelGroup) {
          const value = ts.metric[k];
          let values = extracted.get(labelGroup);
          if (!values) {
            values = {};
            extracted.set(labelGroup, values);
          }
          values[value] = true;
        }
      });
    });
  }
}

export { MetricsProps };
export default Metrics;

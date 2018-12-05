import * as React from 'react';
import { RouteComponentProps } from 'react-router';
import { Link } from 'react-router-dom';
import { Icon } from 'patternfly-react';
import { style } from 'typestyle';
import assign from 'lodash/fp/assign';

import history from '../../app/History';
import MetricsOptionsBar from '../MetricsOptions/MetricsOptionsBar';
import { MetricsLabels as L } from '../MetricsOptions/MetricsLabels';
import * as API from '../../services/Api';
import { computePrometheusQueryInterval } from '../../services/Prometheus';
import { GrafanaInfo } from '../../store/Store';
import * as M from '../../types/Metrics';
import MetricsOptions, { Direction } from '../../types/MetricsOptions';
import { authentication } from '../../utils/Authentication';
import * as MessageCenter from '../../utils/MessageCenter';

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
  metrics?: M.MetricGroup | M.Histogram;
};

type ChartDefinitions = { [key: string]: ChartDefinition };

type MetricsState = {
  chartDefs: ChartDefinitions;
  labelValues: Map<L.LabelName, L.LabelValues>;
};

type ObjectId = {
  namespace: string;
  object: string;
};

type MetricsProps = ObjectId &
  RouteComponentProps<{}> & {
    isPageVisible?: boolean;
    grafanaInfo?: GrafanaInfo;
    objectType: M.MetricsObjectTypes;
    direction: Direction;
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

    this.state = {
      chartDefs: this.getChartsDef(),
      labelValues: new Map()
    };
  }

  getChartsDef(): ChartDefinitions {
    return {
      request_count: { name: 'Request volume', unit: 'ops', component: MetricChart },
      request_duration: { name: 'Request duration', unit: 's', component: HistogramChart },
      request_size: { name: 'Request size', unit: 'B', component: HistogramChart },
      response_size: { name: 'Response size', unit: 'B', component: HistogramChart },
      tcp_received: { name: 'TCP received', unit: 'bps', component: MetricChart },
      tcp_sent: { name: 'TCP sent', unit: 'bps', component: MetricChart }
    };
  }

  fillChartsMetrics(charts: ChartDefinitions, metricsData: M.Metrics) {
    Object.keys(charts).forEach(k => {
      const chart = charts[k];
      if (Metrics.isHistogram(chart)) {
        chart.metrics = metricsData.histograms[k];
      } else {
        chart.metrics = metricsData.metrics[k];
      }
    });
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
        const labelValues = this.extractLabelValues(chartDefs);
        this.setState({
          chartDefs: chartDefs,
          labelValues: labelValues
        });
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Cannot fetch metrics', error));
        console.error(error);
      });
  };

  extractLabelValues(chartDefs: ChartDefinitions): Map<L.LabelName, L.LabelValues> {
    // Find all labels on all series
    const labelsWithValues: Map<L.LabelName, L.LabelValues> = new Map();
    const labelGroups = this.props.direction === 'outbound' ? L.REVERSE_OUTBOUND_LABELS : L.REVERSE_INBOUND_LABELS;
    for (let name in chartDefs) {
      if (chartDefs.hasOwnProperty(name)) {
        const chartDef = chartDefs[name];
        const metrics = chartDef.metrics;
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

  getGrafanaLink(): string {
    if (this.props.grafanaInfo) {
      let grafanaLink;
      switch (this.props.objectType) {
        case M.MetricsObjectTypes.SERVICE:
          grafanaLink = `${this.props.grafanaInfo.url}${this.props.grafanaInfo.serviceDashboardPath}?${
            this.props.grafanaInfo.varService
          }=${this.props.object}.${this.props.namespace}.svc.cluster.local`;
          break;
        case M.MetricsObjectTypes.WORKLOAD:
          grafanaLink = `${this.props.grafanaInfo.url}${this.props.grafanaInfo.workloadDashboardPath}?${
            this.props.grafanaInfo.varNamespace
          }=${this.props.namespace}&${this.props.grafanaInfo.varWorkload}=${this.props.object}`;
          break;
        default:
          grafanaLink = `${this.props.grafanaInfo.url}${this.props.grafanaInfo.workloadDashboardPath}?${
            this.props.grafanaInfo.varNamespace
          }=${this.props.namespace}`;
      }
      return grafanaLink;
    }
    return '';
  }

  onLabelsFiltersChanged = (label: L.LabelName, value: string, checked: boolean) => {
    let newLabels = new Map();
    this.state.labelValues.forEach((val, key) => {
      let newVal = assign(val)({});
      if (key === label) {
        newVal[value] = checked;
      }
      newLabels.set(key, newVal);
    });

    this.setState({ labelValues: newLabels });
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
        <MetricsOptionsBar
          onOptionsChanged={this.onOptionsChanged}
          onRefresh={this.fetchMetrics}
          onLabelsFiltersChanged={this.onLabelsFiltersChanged}
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
          {this.props.grafanaInfo && (
            <span id="grafana-link">
              <a href={this.getGrafanaLink()} target="_blank">
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
    const labelGroups = this.props.direction === 'outbound' ? L.OUTBOUND_LABELS : L.INBOUND_LABELS;
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
    const data = chart.metrics;
    if (!data) {
      return undefined;
    }
    const props: any = {
      key: chartKey,
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

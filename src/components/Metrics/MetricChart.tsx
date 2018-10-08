import graphUtils from '../../utils/Graphing';
import { TimeSeries } from '../../types/Metrics';
import { MetricsLabels as L } from '../MetricsOptions/MetricsLabels';
import MetricsChartBase from './MetricsChartBase';

type MetricChartProps = {
  series: TimeSeries[];
  chartName: string;
  unit: string;
  labelValues: Map<L.PromLabel, L.LabelValues>;
  onExpandRequested?: () => void;
};

export default class MetricsChart extends MetricsChartBase<MetricChartProps> {
  protected getControlKey(): string {
    if (this.props.series.length === 0) {
      return 'blank';
    }

    const labelNames = Object.keys(this.props.series[0].metric);
    if (labelNames.length === 0) {
      return this.props.chartName;
    }

    return this.props.chartName + '-' + labelNames.join('-');
  }

  protected getSeriesData() {
    const filtered = this.props.series.filter(ts => this.isVisibleMetric(ts.metric, this.props.labelValues));
    return {
      x: 'x',
      columns: graphUtils.toC3Columns(this.nameTimeSeries(filtered))
    };
  }
}

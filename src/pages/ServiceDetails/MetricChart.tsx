import graphUtils from '../../utils/Graphing';
import { TimeSeries } from '../../types/Metrics';
import MetricsChartBase from './MetricsChartBase';

type MetricChartProps = {
  series: TimeSeries[];
  familyName: string;
  onExpandRequested?: () => void;
};

export default class MetricsChart extends MetricsChartBase<MetricChartProps> {
  protected get controlKey(): string {
    if (this.props.series.length === 0) {
      return 'blank';
    }

    const labelNames = Object.keys(this.props.series[0].metric);
    if (labelNames.length === 0) {
      return this.props.familyName;
    }

    return this.props.familyName + '-' + labelNames.join('-');
  }

  protected get seriesData() {
    return {
      x: 'x',
      columns: graphUtils.toC3Columns(this.nameTimeSeries('', this.props.series))
    };
  }
}

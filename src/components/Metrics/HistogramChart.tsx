import { Histogram } from '../../types/Metrics';
import graphUtils from '../../utils/Graphing';
import { MetricsLabels as L } from '../MetricsOptions/MetricsLabels';
import MetricsChartBase from './MetricsChartBase';

interface HistogramChartProps {
  histogram: Histogram;
  chartName: string;
  unit: string;
  labelValues: Map<L.PromLabel, L.LabelValues>;
  onExpandRequested?: () => void;
}

class HistogramChart extends MetricsChartBase<HistogramChartProps> {
  protected getControlKey() {
    const keys = Object.keys(this.props.histogram);
    if (keys.length === 0 || this.props.histogram[keys[0]].matrix.length === 0) {
      return 'blank';
    }

    const labelNames = Object.keys(this.props.histogram[keys[0]].matrix[0].metric);
    if (labelNames.length === 0) {
      return this.props.chartName;
    }

    return this.props.chartName + '-' + labelNames.join('-');
  }

  protected getSeriesData() {
    const filtered: Histogram = {};
    Object.keys(this.props.histogram).forEach(stat => {
      filtered[stat] = {
        matrix: this.props.histogram[stat].matrix.filter(ts => this.isVisibleMetric(ts.metric, this.props.labelValues))
      };
      const statName = stat === 'avg' ? 'average' : 'quantile ' + stat;
      this.nameTimeSeries(filtered[stat].matrix, statName);
    });
    return {
      x: 'x',
      columns: graphUtils.histogramToC3Columns(filtered)
    };
  }
}

export default HistogramChart;

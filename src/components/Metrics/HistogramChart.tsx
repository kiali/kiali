import { Histogram } from '../../types/Metrics';
import graphUtils from '../../utils/Graphing';
import MetricsChartBase from './MetricsChartBase';

interface HistogramChartProps {
  histogram: Histogram;
  chartName: string;
  unit: string;
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
    Object.keys(this.props.histogram).forEach(stat => {
      const statName = stat === 'avg' ? 'average' : 'quantile ' + stat;
      this.nameTimeSeries(this.props.histogram[stat].matrix, statName);
    });
    return {
      x: 'x',
      columns: graphUtils.histogramToC3Columns(this.props.histogram)
    };
  }
}

export default HistogramChart;

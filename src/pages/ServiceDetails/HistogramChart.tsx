import { Histogram } from '../../types/Metrics';
import graphUtils from '../../utils/Graphing';
import MetricsChartBase from './MetricsChartBase';

interface HistogramChartProps {
  histogram: Histogram;
  familyName: string;
}

class HistogramChart extends MetricsChartBase<HistogramChartProps> {
  protected get controlKey() {
    if (this.props.histogram.average.matrix.length === 0) {
      return 'blank';
    }

    const labelNames = Object.keys(this.props.histogram.average.matrix[0].metric);
    if (labelNames.length === 0) {
      return this.props.familyName;
    }

    return this.props.familyName + '-' + labelNames.join('-');
  }

  protected get seriesData() {
    return {
      x: 'x',
      columns: graphUtils
        .toC3Columns(this.nameTimeSeries('[avg]', this.props.histogram.average.matrix))
        .concat(graphUtils.toC3Columns(this.nameTimeSeries('[med]', this.props.histogram.median.matrix)))
        .concat(graphUtils.toC3Columns(this.nameTimeSeries('[p95]', this.props.histogram.percentile95.matrix)))
        .concat(graphUtils.toC3Columns(this.nameTimeSeries('[p99]', this.props.histogram.percentile99.matrix)))
    };
  }
}

export default HistogramChart;

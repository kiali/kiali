import { TimeSeries, Histogram } from '../types/Metrics';

export default {
  histogramToC3Columns(histogram: Histogram) {
    const stats = Object.keys(histogram);
    if (stats.length === 0 || histogram[stats[0]].matrix.length === 0) {
      return [['x'], ['']];
    }

    let series = [(['x'] as any[]).concat(histogram[stats[0]].matrix[0].values.map(dp => dp[0] * 1000))];
    stats.forEach(stat => {
      const statSeries = histogram[stat].matrix.map(mat => {
        return [mat.name as any].concat(mat.values.map(dp => dp[1]));
      });
      series = series.concat(statSeries);
    });
    return series;
  },

  toC3Columns(matrix?: TimeSeries[], title?: string) {
    if (!matrix || matrix.length === 0) {
      return [['x'], [title || '']];
    }

    // xseries are timestamps. Timestamps are taken from the first series and assumed
    // that all series have the same timestamps.
    let xseries: any = ['x'];
    xseries = xseries.concat(matrix[0].values.map(dp => dp[0] * 1000));

    // yseries are the values of each serie.
    const yseries: any[] = matrix.map(mat => {
      const serie: any = [title || mat.name];
      return serie.concat(mat.values.map(dp => dp[1]));
    });

    // timestamps + data is the format required by C3 (all concatenated: an array with arrays)
    return [xseries, ...yseries];
  }
};

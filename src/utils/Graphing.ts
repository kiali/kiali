import { TimeSeries } from '../types/Metrics';

export default {
  toC3Columns(matrix: TimeSeries[], title?: string) {
    if (matrix.length === 0) {
      return [['x'], [title || '']];
    }

    return matrix
      .map(mat => {
        let xseries: any = ['x'];
        return xseries.concat(mat.values.map(dp => dp[0] * 1000));
      })
      .concat(
        matrix.map(mat => {
          let yseries: any = [title || mat.name];
          return yseries.concat(mat.values.map(dp => dp[1]));
        })
      );
  }
};

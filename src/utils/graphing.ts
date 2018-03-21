import * as M from '../types/Metrics';

export default {
  toC3Columns(matrix: M.TimeSeries[], title?: string): [string, number][] {
    if (matrix.length === 0) {
      let ret: any = [['x'], [title]];
      return ret;
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

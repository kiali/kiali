export type LinearRegressionResult = {
  predict: (x: number) => [number, number];
};

const roundTo = (number: number, precision: number): number => {
  const factor = 10 ** precision;
  return Math.round(number * factor) / factor;
};

/**
 * Least-squares linear fit for [x, y] pairs; supports optional metrics chart trendlines.
 */
export const linearRegression = (
  data: ReadonlyArray<readonly [number, number | null]>,
  options?: { precision?: number }
): LinearRegressionResult => {
  const precision = options?.precision ?? 2;
  const sum = [0, 0, 0, 0];
  let len = 0;

  for (const [x, y] of data) {
    if (y !== null && Number.isFinite(y)) {
      len++;
      sum[0] += x;
      sum[1] += y;
      sum[2] += x * x;
      sum[3] += x * y;
    }
  }

  const run = len * sum[2] - sum[0] * sum[0];
  const rise = len * sum[3] - sum[0] * sum[1];
  const gradient = run === 0 ? 0 : roundTo(rise / run, precision);
  const intercept = roundTo(sum[1] / len - (gradient * sum[0]) / len, precision);

  const predict = (x: number): [number, number] => {
    return [roundTo(x, precision), roundTo(gradient * x + intercept, precision)];
  };

  return { predict };
};

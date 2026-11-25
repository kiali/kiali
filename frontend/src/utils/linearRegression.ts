// Adapted from regression@2.0.1 (https://github.com/tom-alexander/regression-js).
// Linear fit and decimal rounding follow the upstream `linear` helper used for chart trendlines.
//
// The MIT License
//
// Copyright (c) Tom Alexander <me@tomalexander.co.nz>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

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

import { linearRegression } from '../linearRegression';

describe('linearRegression', () => {
  it('predicts y = 2x for a perfect line', () => {
    const data: [number, number][] = [
      [0, 0],
      [1, 2],
      [2, 4]
    ];
    const fit = linearRegression(data, { precision: 10 });
    expect(fit.predict(3)[1]).toBe(6);
  });

  it('rounds fitted values at precision 10', () => {
    const data: [number, number][] = [
      [0, 1],
      [0.1, 1.5],
      [0.2, 1.7],
      [0.3, 2.1]
    ];
    const fit = linearRegression(data, { precision: 10 });
    expect(fit.predict(0.15)[1]).toBe(1.575);
    expect(fit.predict(0.05)[1]).toBe(1.225);
  });

  it('uses default precision of 2', () => {
    const data: [number, number][] = [
      [0, 0],
      [1, 1]
    ];
    const fit = linearRegression(data);
    expect(fit.predict(0.5)[1]).toBe(0.5);
  });

  it('fits a horizontal line for a single point', () => {
    const fit = linearRegression([[3, 7]], { precision: 10 });
    expect(fit.predict(0)[1]).toBe(7);
    expect(fit.predict(10)[1]).toBe(7);
  });

  it('returns NaN for y when there are no valid points', () => {
    const fit = linearRegression([]);
    expect(Number.isNaN(fit.predict(0)[1])).toBe(true);
    const allNull = linearRegression([
      [0, null],
      [1, null]
    ]);
    expect(Number.isNaN(allNull.predict(0)[1])).toBe(true);
  });

  it('ignores non-finite y values', () => {
    const data: [number, number | null][] = [
      [0, 0],
      [1, NaN],
      [2, 4]
    ];
    const fit = linearRegression(data, { precision: 10 });
    expect(fit.predict(2)[1]).toBe(4);
  });

  it('skips null y values', () => {
    const data: [number, number | null][] = [
      [0, 0],
      [1, null],
      [2, 4]
    ];
    const fit = linearRegression(data, { precision: 10 });
    expect(fit.predict(2)[1]).toBe(4);
  });
});

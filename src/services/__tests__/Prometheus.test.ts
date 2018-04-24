import { computePrometheusQueryInterval } from '../Prometheus';

describe('Prometheus service', () => {
  it('should compute prometheus query interval default', () => {
    const res = computePrometheusQueryInterval(3600);
    expect(res.step).toBe(72);
    expect(res.rateInterval).toBe('72s');
  });

  it('should compute prometheus query interval with expected datapoints', () => {
    const res = computePrometheusQueryInterval(3600, 10);
    expect(res.step).toBe(360);
    expect(res.rateInterval).toBe('360s');
  });

  it('should compute prometheus query interval minimized', () => {
    const res = computePrometheusQueryInterval(3600, 1000);
    expect(res.step).toBe(20);
    expect(res.rateInterval).toBe('20s');
  });
});

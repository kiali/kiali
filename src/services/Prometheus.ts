// Hard-coded 20s minimum. It makes some assumption about prometheus scraping interval, default config in Istio
// being 5s. We assume 4*scrape_interval is a good minimum.
// In any way, the rate interval should never go beyond scrape interval.
//  Eventually TODO: make this minRateInterval configurable or deduced from actual scrape interval.
const minRateInterval = 20;
const defaultExpectedDataPoints = 50;

export interface PrometheusQueryOptions {
  step: number;
  rateInterval: string;
}

// Step is duration / expected datapoints
// Make rateInterval aligned with step
export const computePrometheusQueryInterval = (
  duration: number,
  expectedDataPoints?: number
): PrometheusQueryOptions => {
  const expectedDp = expectedDataPoints || defaultExpectedDataPoints;
  let step = Math.floor(duration / expectedDp);
  if (step < minRateInterval) {
    step = minRateInterval;
  }
  return {
    step: step,
    rateInterval: step + 's'
  };
};

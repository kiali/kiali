import { DurationInSeconds } from '../types/Common';
import { serverConfig } from '../config/ServerConfig';

// The step needs to minimally cover 2 datapoints to get any sort of average. So 2*scrape is the bare
// minimum.  We set rateInterval=step which basically gives us the rate() of each disjoint set.
// (note, another approach could be to set rateInterval=step+scrape, the overlap could produce some
// smoothing). The rateInterval should typically not be < step or you're just omitting datapoints.
const defaultDataPoints = 50;
const defaultScrapeInterval = 15; // seconds
const minDataPoints = 2;

export interface PrometheusRateParams {
  rateInterval: string;
  step: number;
}

export const computePrometheusRateParams = (
  duration: DurationInSeconds,
  dataPoints?: number,
  scrapeInterval?: DurationInSeconds
): PrometheusRateParams => {
  let actualDataPoints = dataPoints || defaultDataPoints;
  if (actualDataPoints < minDataPoints) {
    actualDataPoints = defaultDataPoints;
  }

  const configuredScrapeInterval = serverConfig && serverConfig.prometheus.globalScrapeInterval;
  const actualScrapeInterval = scrapeInterval || configuredScrapeInterval || defaultScrapeInterval;
  const minStep = 2 * actualScrapeInterval;
  let step = Math.floor(duration / actualDataPoints);
  step = step < minStep ? minStep : step;
  return {
    step: step,
    rateInterval: step + 's'
  };
};

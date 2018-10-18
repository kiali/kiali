const safeRate = (rate: string) => (rate ? Number(rate) : 0.0);
const RATE = 'rate';
const RATE3XX = 'rate3XX';
const RATE4XX = 'rate4XX';
const RATE5XX = 'rate5XX';

export interface TrafficRate {
  rate: number;
  rate3xx: number;
  rate4xx: number;
  rate5xx: number;
}

export const getTrafficRate = (element): TrafficRate => {
  return {
    rate: safeRate(element.data(RATE)),
    rate3xx: safeRate(element.data(RATE3XX)),
    rate4xx: safeRate(element.data(RATE4XX)),
    rate5xx: safeRate(element.data(RATE5XX))
  };
};

export const getAccumulatedTrafficRate = (elements): TrafficRate => {
  return elements.reduce(
    (r: TrafficRate, element): TrafficRate => {
      const elementTrafficRate = getTrafficRate(element);
      r.rate += elementTrafficRate.rate;
      r.rate3xx += elementTrafficRate.rate3xx;
      r.rate4xx += elementTrafficRate.rate4xx;
      r.rate5xx += elementTrafficRate.rate5xx;
      return r;
    },
    { rate: 0, rate3xx: 0, rate4xx: 0, rate5xx: 0 }
  );
};

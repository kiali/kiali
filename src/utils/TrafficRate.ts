const safeRate = (rate: string) => (rate ? Number(rate) : 0.0);

export const NODE_HTTP_IN = {
  RATE: 'httpIn',
  RATE3XX: 'httpIn3XX',
  RATE4XX: 'httpIn4XX',
  RATE5XX: 'httpIn5XX'
};
export const NODE_HTTP_OUT = {
  RATE: 'httpOut',
  RATE3XX: 'n/a',
  RATE4XX: 'n/a',
  RATE5XX: 'n/a'
};
export const NODE_TCP_IN = {
  RATE: 'tcpIn',
  RATE3XX: 'n/a',
  RATE4XX: 'n/a',
  RATE5XX: 'n/a'
};
export const NODE_TCP_OUT = {
  RATE: 'tcpOut',
  RATE3XX: 'n/a',
  RATE4XX: 'n/a',
  RATE5XX: 'n/a'
};
export const EDGE_HTTP = {
  RATE: 'http',
  RATE3XX: 'http3XX',
  RATE4XX: 'http4XX',
  RATE5XX: 'http5XX'
};
export const EDGE_TCP = {
  RATE: 'tcp',
  RATE3XX: 'n/a',
  RATE4XX: 'n/a',
  RATE5XX: 'n/a'
};

export interface TrafficRate {
  rate: number;
  rate3xx: number;
  rate4xx: number;
  rate5xx: number;
}

export const getTrafficRate = (element: any, trafficType: any = NODE_HTTP_IN): TrafficRate => {
  return {
    rate: safeRate(element.data(trafficType.RATE)),
    rate3xx: safeRate(element.data(trafficType.RATE3XX)),
    rate4xx: safeRate(element.data(trafficType.RATE4XX)),
    rate5xx: safeRate(element.data(trafficType.RATE5XX))
  };
};

export const getAccumulatedTrafficRate = (elements): TrafficRate => {
  return elements.reduce(
    (r: TrafficRate, element): TrafficRate => {
      const elementTrafficRate = getTrafficRate(element, EDGE_HTTP);
      r.rate += elementTrafficRate.rate;
      r.rate3xx += elementTrafficRate.rate3xx;
      r.rate4xx += elementTrafficRate.rate4xx;
      r.rate5xx += elementTrafficRate.rate5xx;
      return r;
    },
    { rate: 0, rate3xx: 0, rate4xx: 0, rate5xx: 0 }
  );
};

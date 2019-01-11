import { CyNode, CyEdge } from '../components/CytoscapeGraph/CytoscapeGraphUtils';

const safeRate = (rate: string) => (rate ? Number(rate) : 0.0);

const NODE_HTTP_IN = {
  RATE: CyNode.httpIn,
  RATE3XX: CyNode.httpIn3XX,
  RATE4XX: CyNode.httpIn4XX,
  RATE5XX: CyNode.httpIn5XX
};
const EDGE_HTTP = {
  RATE: CyEdge.http,
  RATE3XX: CyEdge.http3XX,
  RATE4XX: CyEdge.http4XX,
  RATE5XX: CyEdge.http5XX
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

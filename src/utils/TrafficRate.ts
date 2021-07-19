import { CyNode, CyEdge } from '../components/CytoscapeGraph/CytoscapeGraphUtils';

const safeRate = (rate: any) => (isNaN(rate) ? 0.0 : Number(rate));

type TRAFFIC_GRPC = {
  RATE: string;
  RATEGRPCERR: string;
  RATENORESPONSE: string;
};

const NODE_GRPC_IN: TRAFFIC_GRPC = {
  RATE: CyNode.grpcIn,
  RATEGRPCERR: CyNode.grpcInErr,
  RATENORESPONSE: CyNode.grpcInNoResponse
};
const EDGE_GRPC: TRAFFIC_GRPC = {
  RATE: CyEdge.grpc,
  RATEGRPCERR: CyEdge.grpcErr,
  RATENORESPONSE: CyEdge.grpcNoResponse
};

export interface TrafficRateGrpc {
  rate: number;
  rateGrpcErr: number;
  rateNoResponse: number;
}

export const getTrafficRateGrpc = (element: any, trafficType: TRAFFIC_GRPC = NODE_GRPC_IN): TrafficRateGrpc => {
  return {
    rate: safeRate(element.data(trafficType.RATE)),
    rateGrpcErr: safeRate(element.data(trafficType.RATEGRPCERR)),
    rateNoResponse: safeRate(element.data(trafficType.RATENORESPONSE))
  };
};

export const getAccumulatedTrafficRateGrpc = (elements): TrafficRateGrpc => {
  return elements.reduce(
    (r: TrafficRateGrpc, element): TrafficRateGrpc => {
      const elementTrafficRate = getTrafficRateGrpc(element, EDGE_GRPC);
      r.rate += elementTrafficRate.rate;
      r.rateGrpcErr += elementTrafficRate.rateGrpcErr;
      r.rateNoResponse += elementTrafficRate.rateNoResponse;
      return r;
    },
    { rate: 0, rateGrpcErr: 0, rateNoResponse: 0 }
  );
};

type TRAFFIC_HTTP = {
  RATE: string;
  RATE3XX: string;
  RATE4XX: string;
  RATE5XX: string;
  RATENORESPONSE: string;
};

const NODE_HTTP_IN: TRAFFIC_HTTP = {
  RATE: CyNode.httpIn,
  RATE3XX: CyNode.httpIn3xx,
  RATE4XX: CyNode.httpIn4xx,
  RATE5XX: CyNode.httpIn5xx,
  RATENORESPONSE: CyNode.httpInNoResponse
};
const EDGE_HTTP: TRAFFIC_HTTP = {
  RATE: CyEdge.http,
  RATE3XX: CyEdge.http3xx,
  RATE4XX: CyEdge.http4xx,
  RATE5XX: CyEdge.http5xx,
  RATENORESPONSE: CyEdge.httpNoResponse
};

export interface TrafficRateHttp {
  rate: number;
  rate3xx: number;
  rate4xx: number;
  rate5xx: number;
  rateNoResponse: number;
}

export const getTrafficRateHttp = (element: any, trafficType: TRAFFIC_HTTP = NODE_HTTP_IN): TrafficRateHttp => {
  return {
    rate: safeRate(element.data(trafficType.RATE)),
    rate3xx: safeRate(element.data(trafficType.RATE3XX)),
    rate4xx: safeRate(element.data(trafficType.RATE4XX)),
    rate5xx: safeRate(element.data(trafficType.RATE5XX)),
    rateNoResponse: safeRate(element.data(trafficType.RATENORESPONSE))
  };
};

export const getAccumulatedTrafficRateHttp = (elements): TrafficRateHttp => {
  return elements.reduce(
    (r: TrafficRateHttp, element): TrafficRateHttp => {
      const elementTrafficRate = getTrafficRateHttp(element, EDGE_HTTP);
      r.rate += elementTrafficRate.rate;
      r.rate3xx += elementTrafficRate.rate3xx;
      r.rate4xx += elementTrafficRate.rate4xx;
      r.rate5xx += elementTrafficRate.rate5xx;
      r.rateNoResponse += elementTrafficRate.rateNoResponse;
      return r;
    },
    { rate: 0, rate3xx: 0, rate4xx: 0, rate5xx: 0, rateNoResponse: 0 }
  );
};

type TRAFFIC_TCP = {
  RATE: string;
};

const NODE_TCP_IN: TRAFFIC_TCP = {
  RATE: CyNode.tcpIn
};
const EDGE_TCP: TRAFFIC_TCP = {
  RATE: CyEdge.tcp
};

export interface TrafficRateTcp {
  rate: number;
}

export const getTrafficRateTcp = (element: any, trafficType: TRAFFIC_TCP = NODE_TCP_IN): TrafficRateTcp => {
  return {
    rate: safeRate(element.data(trafficType.RATE))
  };
};

export const getAccumulatedTrafficRateTcp = (elements): TrafficRateTcp => {
  return elements.reduce(
    (r: TrafficRateTcp, element): TrafficRateTcp => {
      const elementTrafficRate = getTrafficRateTcp(element, EDGE_TCP);
      r.rate += elementTrafficRate.rate;
      return r;
    },
    { rate: 0 }
  );
};

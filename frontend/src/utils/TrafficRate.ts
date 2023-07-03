import _ from 'lodash';
import { EdgeAttr, NodeAttr } from 'types/Graph';

const safeRate = (rate: any) => (isNaN(rate) ? 0.0 : Number(rate));

type TRAFFIC_GRPC = {
  RATE: string;
  RATEGRPCERR: string;
  RATENORESPONSE: string;
};

const NODE_GRPC_IN: TRAFFIC_GRPC = {
  RATE: NodeAttr.grpcIn,
  RATEGRPCERR: NodeAttr.grpcInErr,
  RATENORESPONSE: NodeAttr.grpcInNoResponse
};
const EDGE_GRPC: TRAFFIC_GRPC = {
  RATE: EdgeAttr.grpc,
  RATEGRPCERR: EdgeAttr.grpcErr,
  RATENORESPONSE: EdgeAttr.grpcNoResponse
};

export interface TrafficRateGrpc {
  rate: number;
  rateGrpcErr: number;
  rateNoResponse: number;
}

const data = (elem: any, prop: string, isPF: boolean) => {
  return isPF ? elem.getData()[prop] : elem.data(prop);
};

export const getTrafficRateGrpc = (
  element: any,
  isPF: boolean = false,
  trafficType: TRAFFIC_GRPC = NODE_GRPC_IN
): TrafficRateGrpc => {
  return {
    rate: safeRate(data(element, trafficType.RATE, isPF)),
    rateGrpcErr: safeRate(data(element, trafficType.RATEGRPCERR, isPF)),
    rateNoResponse: safeRate(data(element, trafficType.RATENORESPONSE, isPF))
  };
};

export const getAccumulatedTrafficRateGrpc = (elements: any, isPF: boolean = false): TrafficRateGrpc => {
  return _.reduce(
    elements,
    (r: TrafficRateGrpc, element): TrafficRateGrpc => {
      const elementTrafficRate = getTrafficRateGrpc(element, isPF, EDGE_GRPC);
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
  RATE: NodeAttr.httpIn,
  RATE3XX: NodeAttr.httpIn3xx,
  RATE4XX: NodeAttr.httpIn4xx,
  RATE5XX: NodeAttr.httpIn5xx,
  RATENORESPONSE: NodeAttr.httpInNoResponse
};
const EDGE_HTTP: TRAFFIC_HTTP = {
  RATE: EdgeAttr.http,
  RATE3XX: EdgeAttr.http3xx,
  RATE4XX: EdgeAttr.http4xx,
  RATE5XX: EdgeAttr.http5xx,
  RATENORESPONSE: EdgeAttr.httpNoResponse
};

export interface TrafficRateHttp {
  rate: number;
  rate3xx: number;
  rate4xx: number;
  rate5xx: number;
  rateNoResponse: number;
}

export const getTrafficRateHttp = (
  element: any,
  isPF: boolean = false,
  trafficType: TRAFFIC_HTTP = NODE_HTTP_IN
): TrafficRateHttp => {
  return {
    rate: safeRate(data(element, trafficType.RATE, isPF)),
    rate3xx: safeRate(data(element, trafficType.RATE3XX, isPF)),
    rate4xx: safeRate(data(element, trafficType.RATE4XX, isPF)),
    rate5xx: safeRate(data(element, trafficType.RATE5XX, isPF)),
    rateNoResponse: safeRate(data(element, trafficType.RATENORESPONSE, isPF))
  };
};

export const getAccumulatedTrafficRateHttp = (elements, isPF: boolean = false): TrafficRateHttp => {
  return _.reduce(
    elements,
    (r: TrafficRateHttp, element): TrafficRateHttp => {
      const elementTrafficRate = getTrafficRateHttp(element, isPF, EDGE_HTTP);
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
  RATE: NodeAttr.tcpIn
};
const EDGE_TCP: TRAFFIC_TCP = {
  RATE: EdgeAttr.tcp
};

export interface TrafficRateTcp {
  rate: number;
}

export const getTrafficRateTcp = (
  element: any,
  isPF: boolean = false,
  trafficType: TRAFFIC_TCP = NODE_TCP_IN
): TrafficRateTcp => {
  return {
    rate: safeRate(data(element, trafficType.RATE, isPF))
  };
};

export const getAccumulatedTrafficRateTcp = (elements: any, isPF: boolean = false): TrafficRateTcp => {
  return _.reduce(
    elements,
    (r: TrafficRateTcp, element): TrafficRateTcp => {
      const elementTrafficRate = getTrafficRateTcp(element, isPF, EDGE_TCP);
      r.rate += elementTrafficRate.rate;
      return r;
    },
    { rate: 0 }
  );
};

import { K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';

// Istio types

export interface StringMatch {
  exact?: string;
  prefix?: string;
  regex?: string;
}

export interface PortSelector {
  name?: string;
  number: number;
}

export interface Delay {
  fixedDelay: string;
  percentage?: Percent;
}

export interface Abort {
  httpStatus: number;
  percentage?: Percent;
}

export interface HeaderOperations {
  set?: { [key: string]: string };
  add?: { [key: string]: string };
  remove?: string[];
}

export interface HTTPMatchRequest {
  name?: string;
  uri?: StringMatch;
  scheme?: StringMatch;
  method?: StringMatch;
  authority?: StringMatch;
  headers?: { [key: string]: StringMatch };
  port?: PortSelector;
  sourceLabels?: { [key: string]: string };
  gateways?: string[];
  queryParams?: { [key: string]: StringMatch };
  ignoreUriCase?: boolean;
  withoutHeaders?: { [key: string]: StringMatch };
  sourceNamespace?: string;
}

export interface HTTPRouteDestination {
  destination: Destination;
  weight?: number;
  headers?: Headers;
}

export interface HTTPRedirect {
  uri?: string;
  authority?: string;
  redirectCode?: number;
}

export interface Delegate {
  name?: string;
  namespace?: string;
}

export interface HTTPRewrite {
  uri?: string;
  authority?: string;
}

export interface HTTPRetry {
  attempts: number;
  perTryTimeout?: string;
  retryOn?: string;
  retryRemoteLocalities?: boolean;
}

export interface HTTPFaultInjection {
  delay?: Delay;
  abort?: Abort;
}

export interface Destination {
  host: string;
  subset?: string;
  port?: PortSelector;
}

export interface Percent {
  value: number;
}

export interface CorsPolicy {
  allowOrigin?: StringMatch[];
  allowMethods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: string;
  allowCredentials?: string;
}

export interface Headers {
  request?: HeaderOperations;
  response?: HeaderOperations;
}

export interface TLSMatchAttributes {
  sniHosts: string[];
  destinationSubnets?: string[];
  port?: number;
  sourceLabels?: { [key: string]: string };
  gateways?: string[];
  sourceName?: string;
}

export interface RouteDestination {
  destination: Destination;
  weight?: number;
}

export interface L4MatchAttributes {
  destinationSubnets?: string[];
  port?: number;
  sourceLabels?: { [key: string]: string };
  gateways?: string[];
  sourceName?: string;
}

export interface HTTPRoute {
  name?: string;
  match?: HTTPMatchRequest[];
  route?: HTTPRouteDestination[];
  redirect?: HTTPRedirect;
  delegate?: Delegate;
  rewrite?: HTTPRewrite;
  timeout?: string;
  retries?: HTTPRetry;
  fault?: HTTPFaultInjection;
  mirror?: Destination;
  mirrorPercentage?: Percent;
  corsPolicy?: CorsPolicy;
  headers?: Headers;
}

export interface TLSRoute {
  match?: TLSMatchAttributes[];
  route?: RouteDestination[];
}

export interface TCPRoute {
  match?: L4MatchAttributes[];
  route?: RouteDestination[];
}

export interface VirtualServiceSpec {
  hosts?: string[];
  gateways?: string[] | null;
  http?: HTTPRoute[];
  tls?: TLSRoute[];
  tcp?: TCPRoute[];
  exportTo?: string[] | null;
}

export type VirtualService = {
  spec: VirtualServiceSpec;
} & K8sResourceCommon;
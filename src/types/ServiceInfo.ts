export interface Endpoints {
  addresses?: EndpointAddress[];
  ports?: Port[];
}

interface EndpointAddress {
  ip: string;
  kind?: string;
  name?: string;
}

interface Label {
  labels: Map<string, string>;
}

export interface Port {
  protocol: string;
  port: number;
  name: string;
}

export interface Deployment {
  name: string;
  labels?: Map<string, string>;
  created_at: string;
  replicas: number;
  available_replicas: number;
  unavailable_replicas: number;
  autoscaler: Autoscaler;
}

export interface Autoscaler {
  name: string;
  labels?: Map<string, string>;
  min_replicas: number;
  max_replicas: number;
  target_cpu_utilization_percentage: number;
  current_replicas?: number;
  desired_replicas?: number;
}

export interface StringMatch {
  exact?: string;
  prefix?: string;
  regex?: string;
}

export interface MatchSource {
  name?: string;
  namespace?: string;
  domain?: string;
  service?: string;
  labels?: Map<String, String>;
}

export interface MatchRequest {
  source?: MatchSource;
  request?: Map<string, StringMatch>;
}

export interface RouteRule {
  name: string;
  destination?: Map<string, string>;
  precedence?: number;
  route?: Label[];
  match?: MatchRequest;
}

export interface LoadBalancing {
  name: string;
}

export interface CircuitBreakerPolicy {
  maxConnections?: number;
  httpMaxPendingRequests?: number;
  httpMaxRequests?: number;
  sleepWindow?: string;
  httpConsecutiveErrors?: string;
  httpDetectionInterval?: string;
  httpMaxRequestsPerConnection?: number;
  httpMaxEjectionPercent?: number;
  httpMaxRetries?: number;
}

export interface CircuitBreaker {
  simpleCb: CircuitBreakerPolicy;
}

export interface DestinationPolicy {
  name: string;
  destination: MatchSource;
  source: MatchSource;
  loadbalancing: LoadBalancing;
  circuitBreaker: CircuitBreaker;
}

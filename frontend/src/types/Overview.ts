// Types for Overview metrics APIs

// ServiceLatency represents a single service's latency measurement
export interface ServiceLatency {
  cluster: string;
  latency: number; // in milliseconds
  namespace: string;
  serviceName: string;
}

// ServiceLatencyResponse contains the sorted list of service latencies
export interface ServiceLatencyResponse {
  services: ServiceLatency[];
}

// Query parameters for the service latencies endpoint
export interface ServiceLatencyQuery {
  limit?: number;
  rateInterval?: string;
}

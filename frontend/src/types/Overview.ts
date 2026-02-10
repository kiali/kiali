import { HealthStatusId } from './Health';

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

// ServiceRequests represents a single service's request statistics
export interface ServiceRequests {
  cluster: string;
  errorRate: number; // error rate as a decimal (0.0 to 1.0)
  healthStatus?: HealthStatusId;
  namespace: string;
  requestCount: number; // requests per second
  serviceName: string;
}

// ServiceRequestsResponse contains the sorted list of service request statistics
export interface ServiceRequestsResponse {
  services: ServiceRequests[];
}

// Query parameters for the overview metrics endpoints
export interface OverviewMetricsQuery {
  limit?: number;
  rateInterval?: string;
}

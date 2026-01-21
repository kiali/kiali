// Shared helper functions for traffic graph mock data
import { getScenarioConfig, getItemHealthStatus } from '../../scenarios';

interface AppHealthData {
  requests: {
    healthAnnotations: Record<string, unknown>;
    inbound: { http: Record<string, number> };
    outbound: { http: Record<string, number> };
  };
  workloadStatuses: Array<{
    availableReplicas: number;
    currentReplicas: number;
    desiredReplicas: number;
    name: string;
    syncedProxies: number;
  }>;
}

interface ServiceHealthData {
  requests: {
    healthAnnotations: Record<string, unknown>;
    inbound: { http: Record<string, number> };
    outbound: { http: Record<string, number> };
  };
}

// Helper to get HTTP response distribution based on item health
const getHttpResponses = (itemName?: string, namespace?: string): Record<string, number> => {
  const healthStatus = itemName ? getItemHealthStatus(itemName, namespace) : 'healthy';
  const errorRate = getScenarioConfig().errorRate;

  if (healthStatus === 'unhealthy') {
    return {
      '200': 100 - errorRate - 10,
      '500': errorRate,
      '503': 10
    };
  } else if (healthStatus === 'degraded') {
    return {
      '200': 100 - Math.floor(errorRate / 2) - 5,
      '500': Math.floor(errorRate / 2),
      '503': 5
    };
  }

  return { '200': 100 };
};

// Helper to create app health data
export const createAppHealthData = (workloadName: string, namespace?: string): AppHealthData => {
  const healthStatus = getItemHealthStatus(workloadName, namespace);
  const httpResponses = getHttpResponses(workloadName, namespace);

  return {
    requests: {
      healthAnnotations: {},
      inbound: { http: httpResponses },
      outbound: { http: httpResponses }
    },
    workloadStatuses: [
      {
        availableReplicas: healthStatus === 'unhealthy' ? 0 : 1,
        currentReplicas: 1,
        desiredReplicas: 1,
        name: workloadName,
        syncedProxies: healthStatus === 'unhealthy' ? 0 : 1
      }
    ]
  };
};

// Helper to create service health data
export const createServiceHealthData = (serviceName?: string, namespace?: string): ServiceHealthData => {
  const httpResponses = getHttpResponses(serviceName, namespace);

  return {
    requests: {
      healthAnnotations: {},
      inbound: { http: httpResponses },
      outbound: { http: httpResponses }
    }
  };
};

// Interface for edge traffic
interface EdgeTraffic {
  protocol: string;
  rates: Record<string, string>;
  responses: Record<string, { flags: Record<string, string>; hosts: Record<string, string> }>;
}

// Helper to create edge traffic data based on target's health
// targetName: the app/service/workload name of the edge target
// host: the hostname for the target (e.g., 'reviews:9080')
// rate: the request rate as a string (e.g., '10.00')
export const createEdgeTraffic = (targetName: string, host: string, rate: string, namespace?: string): EdgeTraffic => {
  const healthStatus = getItemHealthStatus(targetName, namespace);
  const errorRate = getScenarioConfig().errorRate;

  // Build responses based on health status
  const responses: Record<string, { flags: Record<string, string>; hosts: Record<string, string> }> = {};

  if (healthStatus === 'unhealthy') {
    const successPct = (100 - errorRate - 10).toFixed(1);
    const error500Pct = errorRate.toFixed(1);
    const error503Pct = '10.0';

    responses['200'] = { flags: { '-': successPct }, hosts: { [host]: successPct } };
    responses['500'] = { flags: { '-': error500Pct }, hosts: { [host]: error500Pct } };
    responses['503'] = { flags: { '-': error503Pct }, hosts: { [host]: error503Pct } };
  } else if (healthStatus === 'degraded') {
    const successPct = (100 - Math.floor(errorRate / 2) - 5).toFixed(1);
    const error500Pct = Math.floor(errorRate / 2).toFixed(1);
    const error503Pct = '5.0';

    responses['200'] = { flags: { '-': successPct }, hosts: { [host]: successPct } };
    responses['500'] = { flags: { '-': error500Pct }, hosts: { [host]: error500Pct } };
    responses['503'] = { flags: { '-': error503Pct }, hosts: { [host]: error503Pct } };
  } else {
    responses['200'] = { flags: { '-': '100.0' }, hosts: { [host]: '100.0' } };
  }

  return {
    protocol: 'http',
    rates: { http: rate, httpPercentReq: '100.0' },
    responses
  };
};

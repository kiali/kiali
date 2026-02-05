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
const getHttpResponses = (itemName?: string, namespace?: string, cluster?: string): Record<string, number> => {
  const healthStatus = itemName ? getItemHealthStatus(itemName, namespace, cluster) : 'healthy';
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
export const createAppHealthData = (workloadName: string, namespace?: string, cluster?: string): AppHealthData => {
  const healthStatus = getItemHealthStatus(workloadName, namespace, cluster);
  const httpResponses = getHttpResponses(workloadName, namespace, cluster);

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
export const createServiceHealthData = (
  serviceName?: string,
  namespace?: string,
  cluster?: string
): ServiceHealthData => {
  const httpResponses = getHttpResponses(serviceName, namespace, cluster);

  return {
    requests: {
      healthAnnotations: {},
      inbound: { http: httpResponses },
      outbound: { http: httpResponses }
    }
  };
};

// Interface for node traffic
interface NodeTraffic {
  protocol: string;
  rates: Record<string, string>;
}

// Helper to create node traffic data with error rates
// itemName: the app/service/workload name for health lookup
// httpIn: inbound request rate (optional)
// httpOut: outbound request rate (optional)
// namespace: optional namespace for health status lookup
// cluster: optional cluster for cluster-specific health status lookup
export const createNodeTraffic = (
  itemName: string,
  httpIn?: string,
  httpOut?: string,
  namespace?: string,
  cluster?: string
): NodeTraffic[] => {
  const healthStatus = getItemHealthStatus(itemName, namespace, cluster);
  const errorRate = getScenarioConfig().errorRate;

  const rates: Record<string, string> = {};

  if (httpIn) {
    rates.httpIn = httpIn;
  }
  if (httpOut) {
    rates.httpOut = httpOut;
  }

  // Add error rates based on health status
  if (healthStatus === 'unhealthy') {
    const errorPct = errorRate + 10; // 500 + 503 errors
    rates.httpPercentErr = errorPct.toFixed(1);
  } else if (healthStatus === 'degraded') {
    const errorPct = Math.floor(errorRate / 2) + 5;
    rates.httpPercentErr = errorPct.toFixed(1);
  }

  return [{ protocol: 'http', rates }];
};

// Interface for edge traffic
interface EdgeTraffic {
  protocol: string;
  rates: Record<string, string>;
  responses: Record<string, { flags: Record<string, string>; hosts: Record<string, string> }>;
}

// Map health status to graph health status ID
// Must match FAILURE.id and DEGRADED.id from types/Health.ts (capitalized)
const healthStatusToId = (status: 'healthy' | 'degraded' | 'unhealthy'): string | undefined => {
  switch (status) {
    case 'unhealthy':
      return 'Failure'; // FAILURE.id from types/Health
    case 'degraded':
      return 'Degraded'; // DEGRADED.id from types/Health
    default:
      return undefined; // Healthy edges don't need healthStatus set
  }
};

// Helper to create edge traffic data based on target's health
// targetName: the app/service/workload name of the edge target
// host: the hostname for the target (e.g., 'reviews:9080')
// rate: the request rate as a string (e.g., '10.00')
// namespace: optional namespace for health status lookup
// cluster: optional cluster for cluster-specific health status lookup
// Returns: { traffic, healthStatus } - traffic object and optional health status for the edge
export const createEdgeTraffic = (
  targetName: string,
  host: string,
  rate: string,
  namespace?: string,
  cluster?: string
): EdgeTraffic & { healthStatus?: string } => {
  const healthStatus = getItemHealthStatus(targetName, namespace, cluster);
  const errorRate = getScenarioConfig().errorRate;

  // Build responses based on health status
  const responses: Record<string, { flags: Record<string, string>; hosts: Record<string, string> }> = {};

  // Calculate rates object with error percentage
  const rateNum = parseFloat(rate);
  let rates: Record<string, string>;

  if (healthStatus === 'unhealthy') {
    const errorPct = errorRate + 10; // 500 errors + 503 errors
    const successPct = (100 - errorPct).toFixed(1);
    const error500Pct = errorRate.toFixed(1);
    const error503Pct = '10.0';
    const http5xxRate = ((rateNum * errorPct) / 100).toFixed(2);

    responses['200'] = { flags: { '-': successPct }, hosts: { [host]: successPct } };
    responses['500'] = { flags: { '-': error500Pct }, hosts: { [host]: error500Pct } };
    responses['503'] = { flags: { '-': error503Pct }, hosts: { [host]: error503Pct } };

    rates = {
      http: rate,
      http5xx: http5xxRate,
      httpPercentErr: errorPct.toFixed(1),
      httpPercentReq: '100.0'
    };
  } else if (healthStatus === 'degraded') {
    const errorPct = Math.floor(errorRate / 2) + 5; // 500 errors + 503 errors
    const successPct = (100 - errorPct).toFixed(1);
    const error500Pct = Math.floor(errorRate / 2).toFixed(1);
    const error503Pct = '5.0';
    const http5xxRate = ((rateNum * errorPct) / 100).toFixed(2);

    responses['200'] = { flags: { '-': successPct }, hosts: { [host]: successPct } };
    responses['500'] = { flags: { '-': error500Pct }, hosts: { [host]: error500Pct } };
    responses['503'] = { flags: { '-': error503Pct }, hosts: { [host]: error503Pct } };

    rates = {
      http: rate,
      http5xx: http5xxRate,
      httpPercentErr: errorPct.toFixed(1),
      httpPercentReq: '100.0'
    };
  } else {
    responses['200'] = { flags: { '-': '100.0' }, hosts: { [host]: '100.0' } };

    rates = {
      http: rate,
      httpPercentReq: '100.0'
    };
  }

  return {
    protocol: 'http',
    rates,
    responses,
    healthStatus: healthStatusToId(healthStatus)
  };
};

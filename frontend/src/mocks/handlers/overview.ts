import { http, HttpResponse } from 'msw';
import { getAllNamespaces, getItemHealthStatus } from '../scenarios';

const toBackendHealthStatus = (healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'notready'): string => {
  switch (healthStatus) {
    case 'unhealthy':
      return 'Failure';
    case 'degraded':
      return 'Degraded';
    case 'notready':
      return 'Not Ready';
    default:
      return 'Healthy';
  }
};

const appDefinitions: Record<string, string[]> = {
  alpha: ['alpha-api', 'alpha-worker'],
  beta: ['beta-api', 'beta-db'],
  bookinfo: ['productpage', 'details', 'reviews', 'ratings'],
  default: ['httpbin', 'sleep'],
  delta: ['delta-api', 'delta-worker'],
  epsilon: ['epsilon-api', 'epsilon-db'],
  gamma: ['gamma-frontend', 'gamma-backend'],
  'idle-ns-1': ['idle-api-1', 'idle-worker-1'],
  'idle-ns-2': ['idle-api-2', 'idle-worker-2'],
  'idle-ns-3': ['idle-api-3', 'idle-worker-3'],
  'idle-ns-4': ['idle-api-4', 'idle-worker-4'],
  'istio-system': ['istiod', 'istio-ingressgateway'],
  kappa: ['kappa-api', 'kappa-worker'],
  lambda: ['lambda-api', 'lambda-db'],
  mu: ['mu-api', 'mu-cache'],
  nu: ['nu-api', 'nu-worker'],
  'travel-agency': ['travels', 'hotels', 'cars', 'flights'],
  'travel-control': ['control', 'mysqldb'],
  'travel-portal': ['voyages', 'viaggi'],
  zeta: ['zeta-api', 'zeta-cache']
};

const serviceDefinitions: Record<string, string[]> = {
  alpha: ['alpha-api', 'alpha-worker'],
  beta: ['beta-api', 'beta-db', 'w-server', 'x-server', 'y-server', 'z-server'],
  bookinfo: ['productpage', 'details', 'reviews', 'ratings'],
  default: ['httpbin', 'sleep'],
  delta: ['delta-api', 'delta-worker'],
  epsilon: ['epsilon-api', 'epsilon-db'],
  gamma: ['gamma-frontend', 'gamma-backend'],
  'istio-system': ['istiod', 'istio-ingressgateway'],
  kappa: ['kappa-api', 'kappa-worker'],
  lambda: ['lambda-api', 'lambda-db'],
  mu: ['mu-api', 'mu-cache'],
  nu: ['nu-api', 'nu-worker'],
  'travel-agency': ['travels', 'hotels', 'cars', 'flights', 'insurances'],
  'travel-control': ['control', 'mysqldb'],
  'travel-portal': ['voyages', 'viaggi'],
  zeta: ['zeta-api', 'zeta-cache']
};

export const overviewHandlers = [
  // Overview app rates
  http.get('*/api/overview/metrics/apps/rates', () => {
    const allNamespaces = getAllNamespaces();
    const apps: Array<{
      appName: string;
      cluster: string;
      healthStatus: string;
      namespace: string;
      requestRateIn: number;
      requestRateOut: number;
    }> = [];

    allNamespaces.forEach(ns => {
      const nsApps = appDefinitions[ns.name] || [];
      nsApps.forEach(appName => {
        const healthStatus = getItemHealthStatus(`${appName}-v1`, ns.name, ns.cluster);
        const hasTraffic = !ns.name.startsWith('idle-');
        apps.push({
          appName,
          cluster: ns.cluster,
          healthStatus: toBackendHealthStatus(healthStatus),
          namespace: ns.name,
          requestRateIn: hasTraffic ? Math.random() * 10 : 0,
          requestRateOut: hasTraffic ? Math.random() * 5 : 0
        });
      });
    });

    return HttpResponse.json({ apps });
  }),

  // Overview service latencies
  http.get('*/api/overview/metrics/services/latency', () => {
    const allNamespaces = getAllNamespaces();
    const services: Array<{
      cluster: string;
      healthStatus: string;
      latency: number;
      namespace: string;
      serviceName: string;
    }> = [];

    allNamespaces.forEach(ns => {
      if (ns.name.startsWith('idle-') || ns.name.startsWith('empty-')) {
        return;
      }
      const nsServices = serviceDefinitions[ns.name] || [];
      nsServices.forEach(serviceName => {
        const healthStatus = getItemHealthStatus(`${serviceName}-v1`, ns.name, ns.cluster);
        services.push({
          cluster: ns.cluster,
          healthStatus: toBackendHealthStatus(healthStatus),
          latency: 10 + Math.random() * 40,
          namespace: ns.name,
          serviceName
        });
      });
    });

    // Sort by latency descending and return top entries
    services.sort((a, b) => b.latency - a.latency);
    return HttpResponse.json({ services: services.slice(0, 6) });
  }),

  // Overview service rates
  http.get('*/api/overview/metrics/services/rates', () => {
    const allNamespaces = getAllNamespaces();
    const services: Array<{
      cluster: string;
      errorRate: number;
      healthStatus: string;
      namespace: string;
      requestRate: number;
      serviceName: string;
    }> = [];

    allNamespaces.forEach(ns => {
      if (ns.name.startsWith('idle-') || ns.name.startsWith('empty-')) {
        return;
      }
      const nsServices = serviceDefinitions[ns.name] || [];
      nsServices.forEach(serviceName => {
        const healthStatus = getItemHealthStatus(`${serviceName}-v1`, ns.name, ns.cluster);
        let errorRate = 0;
        if (healthStatus === 'unhealthy') {
          errorRate = 0.3 + Math.random() * 0.2;
        } else if (healthStatus === 'degraded') {
          errorRate = 0.05 + Math.random() * 0.1;
        }
        services.push({
          cluster: ns.cluster,
          errorRate,
          healthStatus: toBackendHealthStatus(healthStatus),
          namespace: ns.name,
          requestRate: 0.5 + Math.random() * 2,
          serviceName
        });
      });
    });

    // Sort by error rate descending and return top entries
    services.sort((a, b) => b.errorRate - a.errorRate);
    return HttpResponse.json({ services: services.slice(0, 6) });
  })
];

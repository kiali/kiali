// Traffic graph handlers
import { http, HttpResponse } from 'msw';
import { getScenarioConfig, isMultiCluster, getHomeCluster } from '../scenarios';
import { generateSingleClusterTrafficGraph } from './traffic/traffic-singlecluster';
import { generateMultiClusterTrafficGraph } from './traffic/traffic-multicluster';
import { generateAmbientTrafficGraph } from './traffic/traffic-ambient';
import { generateAppGraph, generateServiceGraph, generateWorkloadGraph } from './traffic/entity';

interface TrafficGraphData {
  duration: number;
  elements: { edges: unknown[]; nodes: unknown[] };
  graphType: string;
  timestamp: number;
}

// Generate traffic graph data dynamically based on scenario
const generateTrafficGraphData = (): TrafficGraphData => {
  const homeCluster = getHomeCluster();

  let nodes: any[] = [];
  let edges: any[] = [];

  if (isMultiCluster()) {
    const result = generateMultiClusterTrafficGraph();
    nodes = result.nodes;
    edges = result.edges;
  } else if (getScenarioConfig().ambientEnabled) {
    const result = generateAmbientTrafficGraph(homeCluster.name);
    nodes = result.nodes;
    edges = result.edges;
  } else {
    const result = generateSingleClusterTrafficGraph(homeCluster.name);
    nodes = result.nodes;
    edges = result.edges;
  }

  return {
    timestamp: Math.floor(Date.now() / 1000),
    duration: 60,
    graphType: 'versionedApp',
    elements: { nodes, edges }
  };
};

export const trafficHandlers = [
  // Namespaces graph
  http.get('*/api/namespaces/graph', () => {
    return HttpResponse.json(generateTrafficGraphData());
  }),

  // App graph - returns app-centric graph with traffic
  http.get('*/api/namespaces/:namespace/applications/:app/graph', ({ params, request }) => {
    const { namespace, app } = params;
    const appName = app as string;
    const ns = namespace as string;
    const url = new URL(request.url);
    const clusterName = url.searchParams.get('clusterName') || getHomeCluster().name;

    return HttpResponse.json(generateAppGraph(clusterName, ns, appName));
  }),

  // Service graph - returns service-centric graph with traffic
  http.get('*/api/namespaces/:namespace/services/:service/graph', ({ params, request }) => {
    const { namespace, service } = params;
    const serviceName = service as string;
    const ns = namespace as string;
    const url = new URL(request.url);
    const clusterName = url.searchParams.get('clusterName') || getHomeCluster().name;

    return HttpResponse.json(generateServiceGraph(clusterName, ns, serviceName));
  }),

  // Workload graph - returns workload-centric graph with traffic
  http.get('*/api/namespaces/:namespace/workloads/:workload/graph', ({ params, request }) => {
    const { namespace, workload } = params;
    const workloadName = workload as string;
    const ns = namespace as string;
    const url = new URL(request.url);
    const clusterName = url.searchParams.get('clusterName') || getHomeCluster().name;

    return HttpResponse.json(generateWorkloadGraph(clusterName, ns, workloadName));
  })
];

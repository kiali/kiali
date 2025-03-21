import {
  DecoratedGraphEdgeData,
  DecoratedGraphEdgeWrapper,
  DecoratedGraphElements,
  DecoratedGraphNodeData,
  DecoratedGraphNodeWrapper,
  GraphEdgeWrapper,
  GraphElements,
  GraphNodeWrapper,
  hasProtocolTraffic
} from '../../types/Graph';
import { isIstioNamespace } from '../../config/ServerConfig';
import { AppHealth, NA, ServiceHealth, WorkloadHealth } from 'types/Health';
import { toSafeFieldName } from 'helpers/GraphHelpers';

// When updating the graph, the element data expects to have all the changes.
// non-provided values are taken as "this didn't change", similar as setState does.
// Put default values for all fields that are omitted.
export const decorateGraphData = (graphData: GraphElements, duration: number): DecoratedGraphElements => {
  const elementsDefaults = {
    edges: {
      destPrincipal: undefined,
      grpc: NaN,
      grpcErr: NaN,
      grpcPercentErr: NaN,
      grpcPercentReq: NaN,
      hasTraffic: undefined,
      http: NaN,
      http3xx: NaN,
      http4xx: NaN,
      http5xx: NaN,
      httpNoResponse: NaN,
      httpPercentErr: NaN,
      httpPercentReq: NaN,
      isMTLS: -1,
      protocol: undefined,
      responses: undefined,
      responseTime: NaN,
      sourcePrincipal: undefined,
      tcp: NaN,
      throughput: NaN
    },
    nodes: {
      aggregate: undefined,
      aggregateValue: undefined,
      app: undefined,
      destServices: undefined,
      grpcIn: NaN,
      grpcInErr: NaN,
      grpcOut: NaN,
      hasCB: undefined,
      hasFaultInjection: undefined,
      hasMirroring: undefined,
      hasMissingSC: undefined,
      hasRequestRouting: undefined,
      hasRequestTimeout: undefined,
      hasTCPTrafficShifting: undefined,
      hasTrafficShifting: undefined,
      hasVS: undefined,
      healthData: undefined,
      health: undefined,
      httpIn: NaN,
      httpIn3xx: NaN,
      httpIn4xx: NaN,
      httpIn5xx: NaN,
      httpInNoResponse: NaN,
      httpOut: NaN,
      isAmbient: undefined,
      isBox: undefined,
      isDead: undefined,
      isExtension: undefined,
      isGateway: undefined,
      isIdle: undefined,
      isInaccessible: undefined,
      isIstio: undefined,
      isMisconfigured: undefined,
      isOutside: undefined,
      isRoot: undefined,
      isServiceEntry: undefined,
      isWaypoint: undefined,
      rank: undefined,
      service: undefined,
      tcpIn: NaN,
      tcpOut: NaN,
      version: undefined,
      workload: undefined
    }
  };
  // It's not easy to get find/hide to work exactly as users may expect.  Because edges represent
  // traffic for only one protocol it is best to use 0 defaults for that one protocol, and leave the others
  // as NaN. In that way numerical expressions affect only edges for a desired protocol.  Because nodes
  // can involve traffic from multiple protocols, it seems (for now) best to only set the values explicitly
  // supplied in the JSON.
  const edgeProtocolDefaults = {
    grpc: {
      grpc: 0,
      grpcErr: 0,
      grpcNoResponse: 0,
      grpcPercentErr: 0,
      grpcPercentReq: 0
    },
    http: {
      http: 0,
      http3xx: 0,
      http4xx: 0,
      http5xx: 0,
      httpNoResponse: 0,
      httpPercentErr: 0,
      httpPercentReq: 0
    },
    tcp: {
      tcp: 0
    }
  };

  const propertiesToNumber = (object: Object, keys?: string[]): any => {
    const objectWithNumbers = { ...object };
    const targetKeys = keys ? keys : Object.keys(objectWithNumbers);
    for (const key of targetKeys) {
      objectWithNumbers[key] = Number(objectWithNumbers[key]);
    }
    return objectWithNumbers;
  };

  const decoratedGraph: DecoratedGraphElements = {};
  if (graphData) {
    if (graphData.nodes) {
      decoratedGraph.nodes = graphData.nodes.map((node: GraphNodeWrapper) => {
        const decoratedNode: any = { ...node };
        // parse out the traffic data into top level fields for the various protocols. This is done
        // to be back compatible with our existing ui code that expects the explicit http and tcp fields.
        // We can then set the 'traffic' field undefined because it is not used in the cy element handling.
        if (decoratedNode.data.traffic) {
          const traffic = decoratedNode.data.traffic;
          decoratedNode.data.traffic = undefined;
          traffic.forEach(protocol => {
            decoratedNode.data = { ...propertiesToNumber(protocol.rates), ...decoratedNode.data };
          });
        }
        // we can do something similar with labels, parse out each to data.label_<key>: <value>
        // and then set the field undefined because it is not used in the cy element handling
        if (decoratedNode.data.labels) {
          const labels = decoratedNode.data.labels;
          decoratedNode.data.labels = undefined;
          const prefixedLabels: { [key: string]: string } = {};
          for (const key in labels) {
            prefixedLabels[toSafeFieldName(`label:${key}`)] = labels[key];
          }
          decoratedNode.data = { ...prefixedLabels, ...decoratedNode.data };
        }
        // node.aggregate is set like aggregate=aggregateValue, split into distinct fields for the ui to use
        if (!!decoratedNode.data.aggregate) {
          const aggr = decoratedNode.data.aggregate.split('=');
          decoratedNode.data.aggregate = aggr[0];
          decoratedNode.data.aggregateValue = aggr[1];
        }
        // Calculate health
        if (decoratedNode.data.healthData) {
          if (Array.isArray(decoratedNode.data.healthData)) {
            decoratedNode.data.healthStatus = NA.name;
          } else if (decoratedNode.data.healthData.workloadStatus) {
            decoratedNode.data.health = WorkloadHealth.fromJson(
              decoratedNode.data.namespace,
              decoratedNode.data.workload,
              decoratedNode.data.healthData,
              {
                rateInterval: duration,
                hasSidecar: true,
                hasAmbient: false
              }
            );
            decoratedNode.data.healthStatus = decoratedNode.data.health.getGlobalStatus().name;
          } else if (decoratedNode.data.healthData.workloadStatuses) {
            decoratedNode.data.health = AppHealth.fromJson(
              decoratedNode.data.namespace,
              decoratedNode.data.app,
              decoratedNode.data.healthData,
              {
                rateInterval: duration,
                hasSidecar: true,
                hasAmbient: false
              }
            );
            decoratedNode.data.healthStatus = decoratedNode.data.health.getGlobalStatus().name;
          } else {
            decoratedNode.data.health = ServiceHealth.fromJson(
              decoratedNode.data.namespace,
              decoratedNode.data.service,
              decoratedNode.data.healthData,
              {
                rateInterval: duration,
                hasSidecar: true,
                hasAmbient: false
              }
            );
            decoratedNode.data.healthStatus = decoratedNode.data.health.getGlobalStatus().name;
          }
        }
        const isIstio = isIstioNamespace(decoratedNode.data.namespace) ? true : undefined;
        // prettier-ignore
        decoratedNode.data = { ...elementsDefaults.nodes, ...decoratedNode.data, isIstio: isIstio } as DecoratedGraphNodeData;
        // prettier-ignore
        return decoratedNode as DecoratedGraphNodeWrapper;
      });
    }
    if (graphData.edges) {
      decoratedGraph.edges = graphData.edges.map((edge: GraphEdgeWrapper) => {
        const decoratedEdge: any = { ...edge };
        const { traffic, ...edgeData } = edge.data;
        // see comment above about the 'traffic' data handling
        if (traffic) {
          if (hasProtocolTraffic(traffic)) {
            decoratedEdge.data = {
              hasTraffic: true,
              responses: traffic.responses,
              ...edgeProtocolDefaults[traffic.protocol],
              ...propertiesToNumber(traffic.rates),
              // Base properties that need to be cast as number.
              ...propertiesToNumber(edgeData, ['isMtls', 'responseTime', 'throughput'])
            };
          }
          decoratedEdge.data = { protocol: traffic.protocol, ...decoratedEdge.data };
        }
        if (decoratedEdge.data.waypoint?.fromEdge) {
          let waypointEdge = { ...decoratedEdge.data.waypoint.fromEdge };
          if (waypointEdge.traffic) {
            if (hasProtocolTraffic(waypointEdge.traffic)) {
              waypointEdge = {
                hasTraffic: true,
                responses: waypointEdge.traffic.responses,
                ...edgeProtocolDefaults[waypointEdge.traffic.protocol],
                ...propertiesToNumber(waypointEdge.traffic.rates),
                // Base properties that need to be cast as number.
                ...propertiesToNumber(waypointEdge, ['isMtls', 'responseTime', 'throughput'])
              };
            }
          }
          decoratedEdge.data.waypoint.fromEdge = waypointEdge;
        }
        // prettier-ignore
        decoratedEdge.data = { ...elementsDefaults.edges, ...decoratedEdge.data } as DecoratedGraphEdgeData;
        // prettier-ignore
        return decoratedEdge as DecoratedGraphEdgeWrapper;
      });
    }
  }
  return decoratedGraph;
};

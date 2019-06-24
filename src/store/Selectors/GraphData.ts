// When updating the cytoscape graph, the element data expects to have all the changes
// non provided values are taken as "this didn't change", similar as setState does.
// Put default values for all fields that are omitted.
import { KialiAppState } from '../Store';
import { createSelector } from 'reselect';
import {
  DecoratedGraphEdgeData,
  DecoratedGraphEdgeWrapper,
  DecoratedGraphElements,
  DecoratedGraphNodeData,
  DecoratedGraphNodeWrapper,
  GraphEdgeWrapper,
  GraphElements,
  GraphNodeWrapper
} from '../../types/Graph';

// When updating the cytoscape graph, the element data expects to have all the changes
// non provided values are taken as "this didn't change", similar as setState does.
// Put default values for all fields that are omitted.
export const decorateGraphData = (graphData: GraphElements): DecoratedGraphElements => {
  const elementsDefaults = {
    edges: {
      grpc: 'NaN',
      grpcErr: 'NaN',
      grpcPercentErr: 'NaN',
      grpcPercentReq: 'NaN',
      http: 'NaN',
      http3xx: 'NaN',
      http4xx: 'NaN',
      http5xx: 'NaN',
      httpPercentErr: 'NaN',
      httpPercentReq: 'NaN',
      isMTLS: '-1',
      protocol: undefined,
      responses: undefined,
      responseTime: 'NaN',
      tcp: 'NaN'
    },
    nodes: {
      app: undefined,
      destServices: undefined,
      grpcIn: 'NaN',
      grpcInErr: 'NaN',
      grpcOut: 'NaN',
      hasCB: undefined,
      hasMissingSC: undefined,
      hasVS: undefined,
      httpIn: 'NaN',
      httpIn3xx: 'NaN',
      httpIn4xx: 'NaN',
      httpIn5xx: 'NaN',
      httpOut: 'NaN',
      isDead: undefined,
      isGroup: undefined,
      isInaccessible: undefined,
      isMisconfigured: undefined,
      isOutside: undefined,
      isRoot: undefined,
      isServiceEntry: undefined,
      isUnused: undefined,
      service: undefined,
      tcpIn: 'NaN',
      tcpOut: 'NaN',
      version: undefined,
      workload: undefined
    }
  };
  // It's not easy to get find/hide to work exactly as users users may expect.  Because edges represent
  // traffic for only one protocol it is best to use 0 defaults for that one protocol, and leave the others
  // as NaN. In that way numerical expressions affect only edges for a desired protocol.  Because nodes
  // can involve traffic from multiple protocols, it seems (for now) best to only set the values explicitly
  // supplied in the JSON.
  const edgeProtocolDefaults = {
    grpc: {
      grpc: 0,
      grpcErr: 0,
      grpcPercentErr: 0,
      grpcPercentReq: 0
    },
    http: {
      http: 0,
      http3xx: 0,
      http4xx: 0,
      http5xx: 0,
      httpPercentErr: 0,
      httpPercentReq: 0
    },
    tcp: {
      tcp: 0
    }
  };
  const decoratedGraph: DecoratedGraphElements = {};
  if (graphData) {
    if (graphData.nodes) {
      decoratedGraph.nodes = graphData.nodes.map((node: GraphNodeWrapper) => {
        const decoratedNode: any = { ...node };
        // parse out the traffic data into top level fields for the various protocols. This is done
        // to be back compatible with our existing ui code that expects the explicit http and tcp fields.
        // We can then set the 'traffic' field undefined because it is unused in the cy element handling.
        if (decoratedNode.data.traffic) {
          const traffic = decoratedNode.data.traffic;
          decoratedNode.data.traffic = undefined;
          traffic.forEach(protocol => {
            decoratedNode.data = { ...protocol.rates, ...decoratedNode.data };
          });
        }
        // prettier-ignore
        decoratedNode.data = { ...elementsDefaults.nodes, ...decoratedNode.data } as DecoratedGraphNodeData;
        // prettier-ignore
        return decoratedNode as DecoratedGraphNodeWrapper;
      });
    }
    if (graphData.edges) {
      decoratedGraph.edges = graphData.edges.map((edge: GraphEdgeWrapper) => {
        const decoratedEdge: any = { ...edge };
        const { traffic, ...edgeData } = edge.data;
        // see comment above about the 'traffic' data handling
        if (traffic && traffic.protocol !== '') {
          decoratedEdge.data = {
            protocol: traffic.protocol,
            responses: traffic.responses,
            ...edgeProtocolDefaults[traffic.protocol],
            ...traffic.rates,
            ...edgeData
          };
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

const getGraphData = (state: KialiAppState) => state.graph.graphData;

export const graphDataSelector = createSelector(
  getGraphData,
  // This allows us to save the actual response from the server in the store, but avoid calling the decorateGraphData every time we need to access it
  graphData => decorateGraphData(graphData)
);

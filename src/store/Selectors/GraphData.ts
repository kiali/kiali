// When updating the cytoscape graph, the element data expects to have all the changes
// non provided values are taken as "this didn't change", similar as setState does.
// Put default values for all fields that are omitted.
import { KialiAppState } from '../Store';
import { createSelector } from 'reselect';

// When updating the cytoscape graph, the element data expects to have all the changes
// non provided values are taken as "this didn't change", similar as setState does.
// Put default values for all fields that are omitted.
const decorateGraphData = (graphData: any) => {
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
      isMTLS: undefined,
      isUnused: undefined,
      protocol: undefined,
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
  if (graphData) {
    if (graphData.nodes) {
      graphData.nodes = graphData.nodes.map(node => {
        const decoratedNode = { ...node };
        // parse out the traffic data into top level fields for the various protocols. This is done
        // to be back compatible with our existing ui code that expects the explicit http and tcp fields.
        // We can then set the 'traffic' field undefined because it is unused in the cy element handling.
        // TODO: refactor the code to use the traffic structure.
        if (node.data.traffic) {
          const traffic = node.data.traffic;
          node.data.traffic = undefined;
          traffic.map(protocol => {
            decoratedNode.data = { ...protocol.rates, ...decoratedNode.data };
          });
        }
        decoratedNode.data = { ...elementsDefaults.nodes, ...decoratedNode.data };
        return decoratedNode;
      });
    }
    if (graphData.edges) {
      graphData.edges = graphData.edges.map(edge => {
        const decoratedEdge = { ...edge };
        // see comment above about the 'traffic' data handling
        if (edge.data.traffic) {
          const traffic = edge.data.traffic;
          edge.data.traffic = undefined;
          decoratedEdge.data = { protocol: traffic.protocol, ...traffic.rates, ...decoratedEdge.data };
        }
        decoratedEdge.data = { ...elementsDefaults.edges, ...decoratedEdge.data };
        return decoratedEdge;
      });
    }
  }
  return graphData;
};

const getGraphData = (state: KialiAppState) => state.graph.graphData;

export const graphDataSelector = createSelector(
  getGraphData,
  // This allows us to save the actual response from the server in the store, but avoid calling the decorateGraphData every time we need to access it
  graphData => decorateGraphData(graphData)
);

import { ActionType, createAction } from 'typesafe-actions';

enum GraphDataActionKeys {
  GET_GRAPH_DATA_START = 'GET_GRAPH_DATA_START',
  GET_GRAPH_DATA_SUCCESS = 'GET_GRAPH_DATA_SUCCESS',
  GET_GRAPH_DATA_FAILURE = 'GET_GRAPH_DATA_FAILURE',
  HANDLE_LEGEND = 'HANDLE_LEGEND'
}

// When updating the cytoscape graph, the element data expects to have all the changes
// non provided values are taken as "this didn't change", similar as setState does.
// Put default values for all fields that are omitted.
const decorateGraphData = (graphData: any) => {
  const elementsDefaults = {
    edges: {
      grpc: '0',
      grpcErr: '0',
      http: '0',
      http3xx: '0',
      http4xx: '0',
      http5xx: '0',
      httpPercentErr: '0',
      httpPercentReq: '100',
      isMTLS: undefined,
      isUnused: undefined,
      responseTime: '0',
      tcp: '0'
    },
    nodes: {
      app: undefined,
      destServices: undefined,
      grpcIn: '0',
      grpcInErr: '0',
      grpcOut: '0',
      hasCB: undefined,
      hasMissingSC: undefined,
      hasVS: undefined,
      httpIn: '0',
      httpIn3xx: '0',
      httpIn4xx: '0',
      httpIn5xx: '0',
      httpOut: '0',
      isDead: undefined,
      isGroup: undefined,
      isInaccessible: undefined,
      isMisconfigured: undefined,
      isOutside: undefined,
      isRoot: undefined,
      isServiceEntry: undefined,
      isUnused: undefined,
      service: undefined,
      tcpIn: '0',
      tcpOut: '0',
      version: undefined,
      workload: undefined
    }
  };
  if (graphData) {
    if (graphData.nodes) {
      graphData.nodes = graphData.nodes.map(node => {
        const decoratedNode = { ...node };
        if (node.data.traffic) {
          node.data.traffic.map(protocol => {
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
        if (edge.data.traffic) {
          edge.data.traffic.map(protocol => {
            decoratedEdge.data = { ...protocol.rates, ...decoratedEdge.data };
          });
        }
        decoratedEdge.data = { ...elementsDefaults.edges, ...decoratedEdge.data };
        return decoratedEdge;
      });
    }
  }
  return graphData;
};

// synchronous action creators
export const GraphDataActions = {
  getGraphDataStart: createAction(GraphDataActionKeys.GET_GRAPH_DATA_START),
  getGraphDataSuccess: createAction(
    GraphDataActionKeys.GET_GRAPH_DATA_SUCCESS,
    resolve => (timestamp: number, graphDuration: number, graphData: any) =>
      resolve({
        timestamp: timestamp,
        graphDuration: graphDuration,
        graphData: decorateGraphData(graphData)
      })
  ),
  getGraphDataFailure: createAction(GraphDataActionKeys.GET_GRAPH_DATA_FAILURE, resolve => (error: any) =>
    resolve({ error: error })
  ),
  handleLegend: createAction(GraphDataActionKeys.HANDLE_LEGEND)
};

export type GraphDataAction = ActionType<typeof GraphDataActions>;

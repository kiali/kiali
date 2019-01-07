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
      http: undefined,
      http3XX: undefined,
      http4XX: undefined,
      http5XX: undefined,
      httpPercentErr: undefined,
      httpPercentReq: undefined,
      isMTLS: undefined,
      isUnused: undefined,
      responseTime: undefined,
      tcp: undefined
    },
    nodes: {
      app: undefined,
      destServices: undefined,
      hasCB: undefined,
      hasMissingSC: undefined,
      hasVS: undefined,
      httpIn: undefined,
      httpIn3XX: undefined,
      httpIn4XX: undefined,
      httpIn5XX: undefined,
      httpOut: undefined,
      isDead: undefined,
      isGroup: undefined,
      isInaccessible: undefined,
      isMisconfigured: undefined,
      isOutside: undefined,
      isRoot: undefined,
      isServiceEntry: undefined,
      isUnused: undefined,
      service: undefined,
      tcpIn: undefined,
      tcpOut: undefined,
      version: undefined,
      workload: undefined
    }
  };
  if (graphData) {
    if (graphData.nodes) {
      graphData.nodes = graphData.nodes.map(node => {
        const decoratedNode = { ...node };
        decoratedNode.data = { ...elementsDefaults.nodes, ...decoratedNode.data };
        return decoratedNode;
      });
    }
    if (graphData.edges) {
      graphData.edges = graphData.edges.map(edge => {
        const decoratedEdge = { ...edge };
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

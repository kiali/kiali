import { ActionType, createAction } from 'typesafe-actions';

enum GraphDataActionKeys {
  GET_GRAPH_DATA_START = 'GET_GRAPH_DATA_START',
  GET_GRAPH_DATA_SUCCESS = 'GET_GRAPH_DATA_SUCCESS',
  GET_GRAPH_DATA_FAILURE = 'GET_GRAPH_DATA_FAILURE',
  HANDLE_LEGEND = 'HANDLE_LEGEND'
}

// synchronous action creators
export const GraphDataActions = {
  getGraphDataStart: createAction(GraphDataActionKeys.GET_GRAPH_DATA_START),
  getGraphDataSuccess: createAction(
    GraphDataActionKeys.GET_GRAPH_DATA_SUCCESS,
    resolve => (timestamp: number, graphDuration: number, graphData: any) =>
      resolve({
        timestamp: timestamp,
        graphDuration: graphDuration,
        graphData: graphData
      })
  ),
  getGraphDataFailure: createAction(GraphDataActionKeys.GET_GRAPH_DATA_FAILURE, resolve => (error: any) =>
    resolve({ error: error })
  ),
  handleLegend: createAction(GraphDataActionKeys.HANDLE_LEGEND)
};

export type GraphDataAction = ActionType<typeof GraphDataActions>;

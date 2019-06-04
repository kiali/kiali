import { ActionType, createAction } from 'typesafe-actions';
import { GraphElements } from '../types/Graph';
import { DurationInSeconds, TimeInSeconds } from '../types/Common';
import { ActionKeys } from './ActionKeys';

// synchronous action creators
export const GraphDataActions = {
  getGraphDataStart: createAction(ActionKeys.GET_GRAPH_DATA_START),
  getGraphDataSuccess: createAction(
    ActionKeys.GET_GRAPH_DATA_SUCCESS,
    resolve => (timestamp: TimeInSeconds, graphDuration: DurationInSeconds, graphData: GraphElements) =>
      resolve({
        timestamp: timestamp,
        graphDuration: graphDuration,
        graphData: graphData
      })
  ),
  getGraphDataFailure: createAction(ActionKeys.GET_GRAPH_DATA_FAILURE, resolve => (error: any) =>
    resolve({ error: error })
  ),
  getGraphDataWithoutNamespaces: createAction(ActionKeys.GET_GRAPH_DATA_WITHOUT_NAMESPACES),
  handleLegend: createAction(ActionKeys.HANDLE_LEGEND)
};

export type GraphDataAction = ActionType<typeof GraphDataActions>;

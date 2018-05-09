import { createAction } from 'typesafe-actions';
import Namespace from '../types/Namespace';
import { Duration } from '../types/GraphFilter';
import * as API from '../services/Api';
import * as MessageCenter from '../utils/MessageCenter';

const EMPTY_GRAPH_DATA = { nodes: [], edges: [] };

export enum ServiceGraphDataActionKeys {
  GET_GRAPH_DATA_START = 'GET_GRAPH_DATA_START',
  GET_GRAPH_DATA_SUCCESS = 'GET_GRAPH_DATA_SUCCESS',
  GET_GRAPH_DATA_FAILURE = 'GET_GRAPH_DATA_FAILURE'
}

// synchronous action creators
export const ServiceGraphDataActions = {
  getGraphDataStart: createAction(ServiceGraphDataActionKeys.GET_GRAPH_DATA_START),
  getGraphDataSuccess: createAction(
    ServiceGraphDataActionKeys.GET_GRAPH_DATA_SUCCESS,
    (timestamp: number, graphData: any) => ({
      type: ServiceGraphDataActionKeys.GET_GRAPH_DATA_SUCCESS,
      timestamp: timestamp,
      graphData: graphData
    })
  ),
  getGraphDataFailure: createAction(ServiceGraphDataActionKeys.GET_GRAPH_DATA_FAILURE, (error: any) => ({
    type: ServiceGraphDataActionKeys.GET_GRAPH_DATA_FAILURE,
    error: error
  })),

  // action creator that performs the async request
  fetchGraphData: (namespace: Namespace, graphDuration: Duration) => {
    return dispatch => {
      dispatch(ServiceGraphDataActions.getGraphDataStart());
      const duration = graphDuration.value;
      const restParams = { duration: duration + 's' };
      API.getGraphElements(namespace, restParams).then(
        response => {
          const responseData = response['data'];
          const graphData = responseData && responseData.elements ? responseData.elements : EMPTY_GRAPH_DATA;
          const timestamp = responseData && responseData.timestamp ? responseData.timestamp : 0;
          dispatch(ServiceGraphDataActions.getGraphDataSuccess(timestamp, graphData));
        },
        error => {
          let emsg: string;
          if (error.response && error.response.data && error.response.data.error) {
            emsg = 'Cannot load the graph: ' + error.response.data.error;
          } else {
            emsg = 'Cannot load the graph: ' + error.toString();
          }
          console.log('ServiceGraphDataActions: ', emsg);
          MessageCenter.add(emsg);
          dispatch(ServiceGraphDataActions.getGraphDataFailure(emsg));
        }
      );
    };
  }
};

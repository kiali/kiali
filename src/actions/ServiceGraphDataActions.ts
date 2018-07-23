import { createAction } from 'typesafe-actions';
import Namespace from '../types/Namespace';
import { Duration } from '../types/GraphFilter';
import * as API from '../services/Api';
import { authentication } from '../utils/Authentication';
import { MessageCenterActions } from './MessageCenterActions';
import { ServiceGraphDataActionKeys } from './ServiceGraphDataActionKeys';
import { GraphType } from '../types/Graph';

const EMPTY_GRAPH_DATA = { nodes: [], edges: [] };

// When updating the cytoscape graph, the element data expects to have all the changes
// non provided values are taken as "this didn't change", similar as setState does.
// Put default values for all fields that are omitted.
const decorateGraphData = (graphData: any) => {
  const elementsDefaults = {
    edges: {
      rate: undefined,
      rate3XX: undefined,
      rate4XX: undefined,
      rate5XX: undefined,
      percentErr: undefined,
      percentRate: undefined,
      latency: undefined,
      isUnused: undefined
    },
    nodes: {
      version: undefined,
      rate: undefined,
      rate3XX: undefined,
      rate4XX: undefined,
      rate5XX: undefined,
      hasCB: undefined,
      hasVS: undefined,
      isDead: undefined,
      isGroup: undefined,
      isRoot: undefined,
      isUnused: undefined,
      hasMissingSC: undefined,
      isOutside: undefined
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
export const ServiceGraphDataActions = {
  getGraphDataStart: createAction(ServiceGraphDataActionKeys.GET_GRAPH_DATA_START),
  getGraphDataSuccess: createAction(
    ServiceGraphDataActionKeys.GET_GRAPH_DATA_SUCCESS,
    (timestamp: number, graphData: any) => ({
      type: ServiceGraphDataActionKeys.GET_GRAPH_DATA_SUCCESS,
      timestamp: timestamp,
      graphData: decorateGraphData(graphData)
    })
  ),
  getGraphDataFailure: createAction(ServiceGraphDataActionKeys.GET_GRAPH_DATA_FAILURE, (error: any) => ({
    type: ServiceGraphDataActionKeys.GET_GRAPH_DATA_FAILURE,
    error: error
  })),
  handleLegend: createAction(ServiceGraphDataActionKeys.HANDLE_LEGEND),

  // action creator that performs the async request
  fetchGraphData: (namespace: Namespace, graphDuration: Duration, graphType: GraphType, versioned: boolean) => {
    return dispatch => {
      dispatch(ServiceGraphDataActions.getGraphDataStart());
      const duration = graphDuration.value;
      let restParams = { duration: duration + 's', graphType: graphType, versioned: versioned };
      if (namespace.name === 'istio-system') {
        restParams['includeIstio'] = true;
      }
      return API.getGraphElements(authentication(), namespace, restParams).then(
        response => {
          const responseData: any = response['data'];
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
          dispatch(MessageCenterActions.addMessage(emsg));
          dispatch(ServiceGraphDataActions.getGraphDataFailure(emsg));
        }
      );
    };
  }
};

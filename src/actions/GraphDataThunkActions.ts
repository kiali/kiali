import { ThunkDispatch } from 'redux-thunk';

import Namespace from '../types/Namespace';
import { KialiAppState } from '../store/Store';
import { GraphType, GroupByType, NodeParamsType } from '../types/Graph';
import { AppenderString, DurationInSeconds } from '../types/Common';
import { KialiAppAction } from './KialiAppAction';
import { GraphDataActions } from './GraphDataActions';
import { MessageCenterActions } from './MessageCenterActions';
import { EdgeLabelMode } from '../types/GraphFilter';
import * as API from '../services/Api';
import { serverConfig } from '../config/ServerConfig';
import { PromisesRegistry } from '../utils/CancelablePromises';

const EMPTY_GRAPH_DATA = { nodes: [], edges: [] };

const promiseRegistry = new PromisesRegistry();

const setCurrentRequest = (promise: Promise<any>) => {
  return promiseRegistry.register('CURRENT_REQUEST', promise);
};

const GraphDataThunkActions = {
  // action creator that performs the async request
  fetchGraphData: (
    namespaces: Namespace[],
    duration: DurationInSeconds,
    graphType: GraphType,
    injectServiceNodes: boolean,
    edgeLabelMode: EdgeLabelMode,
    showSecurity: boolean,
    showUnusedNodes: boolean,
    node?: NodeParamsType
  ) => {
    return (dispatch: ThunkDispatch<KialiAppState, undefined, KialiAppAction>, _getState: () => KialiAppState) => {
      if (namespaces.length === 0) {
        dispatch(GraphDataActions.getGraphDataWithoutNamespaces());
        return Promise.resolve();
      }
      dispatch(GraphDataActions.getGraphDataStart());
      const restParams: any = {
        duration: duration + 's',
        graphType: graphType,
        injectServiceNodes: injectServiceNodes
      };
      if (namespaces.find(namespace => namespace.name === serverConfig.istioNamespace)) {
        restParams.includeIstio = true;
      }

      if (graphType === GraphType.APP || graphType === GraphType.VERSIONED_APP) {
        restParams.groupBy = GroupByType.APP;
      }

      // Some appenders are expensive so only specify an appender if needed.
      let appenders: AppenderString = 'deadNode,sidecarsCheck,serviceEntry,istio';

      if (!node && showUnusedNodes) {
        // note we only use the unusedNode appender if this is NOT a drilled-in node graph and
        // the user specifically requests to see unused nodes.
        appenders += ',unusedNode';
      }

      if (showSecurity) {
        appenders += ',securityPolicy';
      }

      switch (edgeLabelMode) {
        case EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE:
          appenders += ',responseTime';
          break;

        case EdgeLabelMode.REQUESTS_PER_SECOND:
        case EdgeLabelMode.REQUESTS_PERCENTAGE:
        case EdgeLabelMode.NONE:
        default:
          break;
      }
      restParams.appenders = appenders;

      if (node) {
        return setCurrentRequest(API.getNodeGraphElements(node, restParams)).then(
          response => {
            const responseData: any = response.data;
            const graphData = responseData && responseData.elements ? responseData.elements : EMPTY_GRAPH_DATA;
            const timestamp = responseData && responseData.timestamp ? responseData.timestamp : 0;
            const graphDuration = responseData && responseData.duration ? responseData.duration : 0;
            dispatch(GraphDataActions.getGraphDataSuccess(timestamp, graphDuration, graphData));
          },
          error => {
            let emsg: string;
            if (error.isCanceled) {
              return;
            }
            if (error.response && error.response.data && error.response.data.error) {
              emsg = 'Cannot load the graph: ' + error.response.data.error;
            } else {
              emsg = 'Cannot load the graph: ' + error.toString();
            }
            dispatch(MessageCenterActions.addMessage(emsg));
            dispatch(GraphDataActions.getGraphDataFailure(emsg));
          }
        );
      }

      restParams.namespaces = namespaces.map(namespace => namespace.name).join(',');
      return setCurrentRequest(API.getGraphElements(restParams)).then(
        response => {
          const responseData: any = response.data;
          const graphData = responseData && responseData.elements ? responseData.elements : EMPTY_GRAPH_DATA;
          const timestamp = responseData && responseData.timestamp ? responseData.timestamp : 0;
          const graphDuration = responseData && responseData.duration ? responseData.duration : 0;
          dispatch(GraphDataActions.getGraphDataSuccess(timestamp, graphDuration, graphData));
        },
        error => {
          let emsg: string;
          if (error.isCanceled) {
            return;
          }
          if (error.response && error.response.data && error.response.data.error) {
            emsg = 'Cannot load the graph: ' + error.response.data.error;
          } else {
            emsg = 'Cannot load the graph: ' + error.toString();
          }
          dispatch(MessageCenterActions.addMessage(emsg));
          dispatch(GraphDataActions.getGraphDataFailure(emsg));
        }
      );
    };
  }
};

export default GraphDataThunkActions;

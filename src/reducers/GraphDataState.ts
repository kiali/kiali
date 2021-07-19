import { getType } from 'typesafe-actions';
import { GraphActions } from '../actions/GraphActions';
import { KialiAppAction } from '../actions/KialiAppAction';
import { GraphState } from '../store/Store';
import { GraphType, TrafficRate } from '../types/Graph';
import { GraphToolbarActions } from '../actions/GraphToolbarActions';
import { DagreGraph } from '../components/CytoscapeGraph/graphs/DagreGraph';
import { updateState } from '../utils/Reducer';

export const INITIAL_GRAPH_STATE: GraphState = {
  graphDefinition: null,
  layout: DagreGraph.getLayout(),
  node: undefined,
  summaryData: null,
  toolbarState: {
    boxByCluster: false,
    boxByNamespace: false,
    compressOnHide: true,
    edgeLabels: [],
    findValue: '',
    graphType: GraphType.VERSIONED_APP,
    hideValue: '',
    showFindHelp: false,
    showIdleEdges: false,
    showIdleNodes: false,
    showLegend: false,
    showMissingSidecars: true,
    showOperationNodes: false,
    showSecurity: false,
    showServiceNodes: true,
    showTrafficAnimation: false,
    showVirtualServices: true,
    trafficRates: [
      TrafficRate.GRPC_GROUP,
      TrafficRate.GRPC_REQUEST,
      TrafficRate.HTTP_GROUP,
      TrafficRate.HTTP_REQUEST,
      TrafficRate.TCP_GROUP,
      TrafficRate.TCP_SENT
    ]
  },
  updateTime: 0
};

// This Reducer allows changes to the 'graphDataState' portion of Redux Store
const graphDataState = (state: GraphState = INITIAL_GRAPH_STATE, action: KialiAppAction): GraphState => {
  switch (action.type) {
    case getType(GraphActions.onNamespaceChange):
      return updateState(state, {
        summaryData: INITIAL_GRAPH_STATE.summaryData
      });
    case getType(GraphActions.setGraphDefinition):
      return updateState(state, { graphDefinition: action.payload });
    case getType(GraphActions.setLayout):
      return updateState(state, { layout: action.payload });
    case getType(GraphActions.setNode):
      return updateState(state, {
        node: action.payload,
        // TODO: This should be handled in GraphPage.ComponentDidUpdate (Init graph on node change)
        summaryData: INITIAL_GRAPH_STATE.summaryData
      });
    case getType(GraphActions.setUpdateTime):
      return updateState(state, {
        updateTime: action.payload
      });
    case getType(GraphActions.updateSummary):
      return updateState(state, {
        summaryData: updateState(state.summaryData, {
          summaryType: action.payload.summaryType,
          summaryTarget: action.payload.summaryTarget
        })
      });
    // Filter actions
    //
    case getType(GraphToolbarActions.setEdgeLabels):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          edgeLabels: action.payload
        })
      });
    case getType(GraphToolbarActions.setFindValue):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          findValue: action.payload
        })
      });
    case getType(GraphToolbarActions.setGraphType):
      const isServiceGraph = action.payload === GraphType.SERVICE;
      const showOperationNodes = isServiceGraph ? false : state.toolbarState.showOperationNodes;
      const showServiceNodes = isServiceGraph ? false : state.toolbarState.showServiceNodes;
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          graphType: action.payload,
          showOperationNodes: showOperationNodes,
          showServiceNodes: showServiceNodes
        }),
        // TODO: This should be handled in GraphPage.ComponentDidUpdate (Init graph on type change)
        summaryData: INITIAL_GRAPH_STATE.summaryData
      });
    case getType(GraphToolbarActions.setHideValue):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          hideValue: action.payload
        })
      });
    case getType(GraphToolbarActions.setIdleNodes):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showIdleNodes: action.payload
        })
      });
    case getType(GraphToolbarActions.setTrafficRates):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          trafficRates: action.payload
        })
      });

    case getType(GraphToolbarActions.toggleBoxByCluster):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          boxByCluster: !state.toolbarState.boxByCluster
        })
      });
    case getType(GraphToolbarActions.toggleBoxByNamespace):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          boxByNamespace: !state.toolbarState.boxByNamespace
        })
      });
    case getType(GraphToolbarActions.toggleCompressOnHide):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          compressOnHide: !state.toolbarState.compressOnHide
        })
      });
    case getType(GraphToolbarActions.toggleFindHelp):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showFindHelp: !state.toolbarState.showFindHelp
        })
      });
    case getType(GraphToolbarActions.toggleGraphVirtualServices):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showVirtualServices: !state.toolbarState.showVirtualServices
        })
      });
    case getType(GraphToolbarActions.toggleGraphMissingSidecars):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showMissingSidecars: !state.toolbarState.showMissingSidecars
        })
      });
    case getType(GraphToolbarActions.toggleGraphSecurity):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showSecurity: !state.toolbarState.showSecurity
        })
      });
    case getType(GraphToolbarActions.toggleIdleEdges):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showIdleEdges: !state.toolbarState.showIdleEdges
        })
      });
    case getType(GraphToolbarActions.toggleIdleNodes):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showIdleNodes: !state.toolbarState.showIdleNodes
        })
      });
    case getType(GraphToolbarActions.toggleLegend):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showLegend: !state.toolbarState.showLegend
        })
      });
    case getType(GraphToolbarActions.toggleOperationNodes):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showOperationNodes: !state.toolbarState.showOperationNodes
        }),
        // TODO: This should be handled in GraphPage.ComponentDidUpdate (Init graph on type change)
        summaryData: INITIAL_GRAPH_STATE.summaryData
      });
    case getType(GraphToolbarActions.toggleServiceNodes):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showServiceNodes: !state.toolbarState.showServiceNodes
        }),
        // TODO: This should be handled in GraphPage.ComponentDidUpdate (Init graph on type change)
        summaryData: INITIAL_GRAPH_STATE.summaryData
      });
    case getType(GraphToolbarActions.toggleTrafficAnimation):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showTrafficAnimation: !state.toolbarState.showTrafficAnimation
        })
      });
    default:
      // Return unmodified state if there are no changes.
      return state;
  }
};

export default graphDataState;

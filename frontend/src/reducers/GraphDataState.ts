import { getType } from 'typesafe-actions';
import { GraphActions } from '../actions/GraphActions';
import { KialiAppAction } from '../actions/KialiAppAction';
import { GraphState } from '../store/Store';
import { EdgeMode, GraphType, TrafficRate } from '../types/Graph';
import { GraphToolbarActions } from '../actions/GraphToolbarActions';
import { updateState } from '../utils/Reducer';
import { KialiDagreGraph } from '../components/CytoscapeGraph/graphs/KialiDagreGraph';

export const INITIAL_GRAPH_STATE: GraphState = {
  edgeMode: EdgeMode.ALL,
  graphDefinition: null,
  layout: KialiDagreGraph.getLayout(),
  namespaceLayout: KialiDagreGraph.getLayout(),
  node: undefined,
  rankResult: {
    upperBound: 0
  },
  summaryData: null,
  toolbarState: {
    boxByCluster: true,
    boxByNamespace: true,
    edgeLabels: [],
    findValue: '',
    graphType: GraphType.VERSIONED_APP,
    hideValue: '',
    rankBy: [],
    showFindHelp: false,
    showIdleEdges: false,
    showIdleNodes: false,
    showLegend: false,
    showOutOfMesh: true,
    showOperationNodes: false,
    showRank: false,
    showSecurity: false,
    showServiceNodes: true,
    showTrafficAnimation: false,
    showVirtualServices: true,
    showWaypoints: false,
    trafficRates: [
      TrafficRate.AMBIENT_GROUP,
      TrafficRate.AMBIENT_TOTAL,
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
export const GraphDataStateReducer = (state: GraphState = INITIAL_GRAPH_STATE, action: KialiAppAction): GraphState => {
  switch (action.type) {
    case getType(GraphActions.onNamespaceChange):
      return updateState(state, {
        summaryData: INITIAL_GRAPH_STATE.summaryData
      });
    case getType(GraphActions.setEdgeMode): {
      return updateState(state, { edgeMode: action.payload });
    }
    case getType(GraphActions.setGraphDefinition):
      return updateState(state, { graphDefinition: action.payload });
    case getType(GraphActions.setLayout):
      return updateState(state, { layout: action.payload });
    case getType(GraphActions.setNamespaceLayout):
      return updateState(state, { namespaceLayout: action.payload });
    case getType(GraphActions.setNode):
      return updateState(state, {
        node: action.payload,
        // TODO: This should be handled in GraphPage.ComponentDidUpdate (Init graph on node change)
        summaryData: INITIAL_GRAPH_STATE.summaryData
      });
    case getType(GraphActions.setRankResult):
      return updateState(state, { rankResult: action.payload });
    case getType(GraphActions.setUpdateTime):
      return updateState(state, {
        updateTime: action.payload
      });
    case getType(GraphActions.updateSummary):
      return updateState(state, {
        summaryData: updateState(state.summaryData, {
          isPF: action.payload.isPF,
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
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          graphType: action.payload
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
    case getType(GraphToolbarActions.setRankBy):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          rankBy: action.payload
        })
      });
    case getType(GraphToolbarActions.setTrafficRates):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          trafficRates: action.payload
        })
      });
    case getType(GraphToolbarActions.resetSettings):
      return updateState(state, {
        toolbarState: INITIAL_GRAPH_STATE.toolbarState
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
          showOutOfMesh: !state.toolbarState.showOutOfMesh
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
    case getType(GraphToolbarActions.toggleRank):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showRank: !state.toolbarState.showRank
        })
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
    case getType(GraphToolbarActions.toggleWaypoints):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showWaypoints: !state.toolbarState.showWaypoints
        })
      });
    default:
      // Return unmodified state if there are no changes.
      return state;
  }
};

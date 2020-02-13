import { getType } from 'typesafe-actions';
import { GraphActions } from '../actions/GraphActions';
import { KialiAppAction } from '../actions/KialiAppAction';
import { GraphState } from '../store/Store';
import { EdgeLabelMode, GraphType } from '../types/Graph';
import { GraphToolbarActions } from '../actions/GraphToolbarActions';
import { DagreGraph } from '../components/CytoscapeGraph/graphs/DagreGraph';
import { updateState } from '../utils/Reducer';

export const INITIAL_GRAPH_STATE: GraphState = {
  cyData: null,
  layout: DagreGraph.getLayout(),
  node: undefined,
  summaryData: null,
  toolbarState: {
    compressOnHide: true,
    edgeLabelMode: EdgeLabelMode.NONE,
    findValue: '',
    graphType: GraphType.VERSIONED_APP,
    hideValue: '',
    showCircuitBreakers: true,
    showFindHelp: false,
    showLegend: false,
    showMissingSidecars: true,
    showNodeLabels: true,
    showSecurity: false,
    showServiceNodes: true,
    showTrafficAnimation: false,
    showUnusedNodes: false,
    showVirtualServices: true
  }
};

// This Reducer allows changes to the 'graphDataState' portion of Redux Store
const graphDataState = (state: GraphState = INITIAL_GRAPH_STATE, action: KialiAppAction): GraphState => {
  switch (action.type) {
    case getType(GraphActions.changed):
      return updateState(state, {
        summaryData: INITIAL_GRAPH_STATE.summaryData
      });
    case getType(GraphActions.setLayout):
      return updateState(state, { layout: action.payload });
    case getType(GraphActions.setNode):
      return updateState(state, {
        node: action.payload,
        // TODO: This should be handled in GraphPage.ComponentDidUpdate (Init graph on node change)
        summaryData: INITIAL_GRAPH_STATE.summaryData
      });
    case getType(GraphActions.updateGraph):
      return updateState(state, {
        cyData: updateState(state.cyData, {
          updateTimestamp: action.payload.updateTimestamp,
          cyRef: action.payload.cyRef
        })
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
    case getType(GraphToolbarActions.setEdgelLabelMode):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          edgeLabelMode: action.payload
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
    case getType(GraphToolbarActions.setShowUnusedNodes):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showUnusedNodes: action.payload
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
    case getType(GraphToolbarActions.toggleGraphNodeLabel):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showNodeLabels: !state.toolbarState.showNodeLabels
        })
      });
    case getType(GraphToolbarActions.toggleGraphCircuitBreakers):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showCircuitBreakers: !state.toolbarState.showCircuitBreakers
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
    case getType(GraphToolbarActions.toggleLegend):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showLegend: !state.toolbarState.showLegend
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
    case getType(GraphToolbarActions.toggleUnusedNodes):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showUnusedNodes: !state.toolbarState.showUnusedNodes
        })
      });
    default:
      // Return unmodified state if there are no changes.
      return state;
  }
};

export default graphDataState;

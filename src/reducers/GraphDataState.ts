import { getType } from 'typesafe-actions';
import { GraphActions } from '../actions/GraphActions';
import { GraphDataActions } from '../actions/GraphDataActions';
import { KialiAppAction } from '../actions/KialiAppAction';
import { GraphState } from '../store/Store';
import { EdgeLabelMode } from '../types/GraphFilter';
import { GraphType } from '../types/Graph';
import { GraphFilterActions } from '../actions/GraphFilterActions';
import { DagreGraph } from '../components/CytoscapeGraph/graphs/DagreGraph';
import { updateState } from '../utils/Reducer';

export const INITIAL_GRAPH_STATE: GraphState = {
  cyData: null,
  isLoading: false,
  isError: false,
  error: undefined,
  graphDataDuration: 0,
  graphDataTimestamp: 0,
  graphData: {},
  layout: DagreGraph.getLayout(),
  node: undefined,
  summaryData: null,
  filterState: {
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
    case getType(GraphDataActions.getGraphDataStart):
      return updateState(state, { isError: false, isLoading: true });
    case getType(GraphDataActions.getGraphDataSuccess):
      return updateState(state, {
        isLoading: false,
        isError: false,
        graphDataDuration: action.payload.graphDuration,
        graphDataTimestamp: action.payload.timestamp,
        graphData: action.payload.graphData
      });
    case getType(GraphDataActions.getGraphDataFailure):
      return updateState(state, {
        isLoading: false,
        isError: true,
        error: action.payload.error
      });
    case getType(GraphDataActions.getGraphDataWithoutNamespaces):
      return updateState(state, {
        isLoading: false,
        isError: false,
        error: INITIAL_GRAPH_STATE.error,
        graphData: INITIAL_GRAPH_STATE.graphData,
        graphDataDuration: INITIAL_GRAPH_STATE.graphDataDuration,
        graphDataTimestamp: INITIAL_GRAPH_STATE.graphDataTimestamp,
        summaryData: INITIAL_GRAPH_STATE.summaryData
      });
    case getType(GraphActions.changed):
      return updateState(state, {
        graphData: INITIAL_GRAPH_STATE.graphData,
        graphDataDuration: INITIAL_GRAPH_STATE.graphDataDuration,
        graphDataTimestamp: INITIAL_GRAPH_STATE.graphDataTimestamp,
        summaryData: INITIAL_GRAPH_STATE.summaryData
      });
    case getType(GraphActions.setLayout):
      return updateState(state, { layout: action.payload });
    case getType(GraphActions.setNode):
      return updateState(state, {
        node: action.payload,
        // TODO: This should be handled in GraphPage.ComponentDidUpdate (Init graph on node change)
        graphData: INITIAL_GRAPH_STATE.graphData,
        graphDataDuration: INITIAL_GRAPH_STATE.graphDataDuration,
        graphDataTimestamp: INITIAL_GRAPH_STATE.graphDataTimestamp,
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
    case getType(GraphFilterActions.setEdgelLabelMode):
      return updateState(state, {
        filterState: updateState(state.filterState, {
          edgeLabelMode: action.payload
        })
      });
    case getType(GraphFilterActions.setFindValue):
      return updateState(state, {
        filterState: updateState(state.filterState, {
          findValue: action.payload
        })
      });
    case getType(GraphFilterActions.setGraphType):
      return updateState(state, {
        filterState: updateState(state.filterState, {
          graphType: action.payload
        }),
        // TODO: This should be handled in GraphPage.ComponentDidUpdate (Init graph on type change)
        graphData: INITIAL_GRAPH_STATE.graphData,
        graphDataDuration: INITIAL_GRAPH_STATE.graphDataDuration,
        graphDataTimestamp: INITIAL_GRAPH_STATE.graphDataTimestamp,
        summaryData: INITIAL_GRAPH_STATE.summaryData
      });
    case getType(GraphFilterActions.setHideValue):
      return updateState(state, {
        filterState: updateState(state.filterState, {
          hideValue: action.payload
        })
      });
    case getType(GraphFilterActions.setShowUnusedNodes):
      return updateState(state, {
        filterState: updateState(state.filterState, {
          showUnusedNodes: action.payload
        })
      });
    case getType(GraphFilterActions.toggleFindHelp):
      return updateState(state, {
        filterState: updateState(state.filterState, {
          showFindHelp: !state.filterState.showFindHelp
        })
      });
    case getType(GraphFilterActions.toggleGraphNodeLabel):
      return updateState(state, {
        filterState: updateState(state.filterState, {
          showNodeLabels: !state.filterState.showNodeLabels
        })
      });
    case getType(GraphFilterActions.toggleGraphCircuitBreakers):
      return updateState(state, {
        filterState: updateState(state.filterState, {
          showCircuitBreakers: !state.filterState.showCircuitBreakers
        })
      });
    case getType(GraphFilterActions.toggleGraphVirtualServices):
      return updateState(state, {
        filterState: updateState(state.filterState, {
          showVirtualServices: !state.filterState.showVirtualServices
        })
      });
    case getType(GraphFilterActions.toggleGraphMissingSidecars):
      return updateState(state, {
        filterState: updateState(state.filterState, {
          showMissingSidecars: !state.filterState.showMissingSidecars
        })
      });
    case getType(GraphFilterActions.toggleGraphSecurity):
      return updateState(state, {
        filterState: updateState(state.filterState, {
          showSecurity: !state.filterState.showSecurity
        })
      });
    case getType(GraphFilterActions.toggleLegend):
      return updateState(state, {
        filterState: updateState(state.filterState, {
          showLegend: !state.filterState.showLegend
        })
      });
    case getType(GraphFilterActions.toggleServiceNodes):
      return updateState(state, {
        filterState: updateState(state.filterState, {
          showServiceNodes: !state.filterState.showServiceNodes
        }),
        // TODO: This should be handled in GraphPage.ComponentDidUpdate (Init graph on type change)
        graphData: INITIAL_GRAPH_STATE.graphData,
        graphDataDuration: INITIAL_GRAPH_STATE.graphDataDuration,
        graphDataTimestamp: INITIAL_GRAPH_STATE.graphDataTimestamp,
        summaryData: INITIAL_GRAPH_STATE.summaryData
      });
    case getType(GraphFilterActions.toggleTrafficAnimation):
      return updateState(state, {
        filterState: updateState(state.filterState, {
          showTrafficAnimation: !state.filterState.showTrafficAnimation
        })
      });
    case getType(GraphFilterActions.toggleUnusedNodes):
      return updateState(state, {
        filterState: updateState(state.filterState, {
          showUnusedNodes: !state.filterState.showUnusedNodes
        })
      });
    default:
      // Return unmodified state if there are no changes.
      return state;
  }
};

export default graphDataState;

import { getType } from 'typesafe-actions';
import { GraphActions } from '../actions/GraphActions';
import { GraphDataActions } from '../actions/GraphDataActions';
import { KialiAppAction } from '../actions/KialiAppAction';
import { GraphState } from '../store/Store';
import { EdgeLabelMode } from '../types/GraphFilter';
import { GraphType } from '../types/Graph';
import { GraphFilterActions } from '../actions/GraphFilterActions';
import { DagreGraph } from '../components/CytoscapeGraph/graphs/DagreGraph';

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
  const newState: GraphState = {
    ...state
  };

  switch (action.type) {
    case getType(GraphDataActions.getGraphDataStart):
      newState.isLoading = true;
      newState.isError = false;
      break;
    case getType(GraphDataActions.getGraphDataSuccess):
      newState.isLoading = false;
      newState.isError = false;
      newState.graphDataDuration = action.payload.graphDuration;
      newState.graphDataTimestamp = action.payload.timestamp;
      newState.graphData = action.payload.graphData;
      break;
    case getType(GraphDataActions.getGraphDataFailure):
      newState.isLoading = false;
      newState.isError = true;
      newState.error = action.payload.error;
      break;
    case getType(GraphDataActions.getGraphDataWithoutNamespaces):
      newState.isLoading = false;
      newState.isError = false;
      newState.error = INITIAL_GRAPH_STATE.error;
      newState.graphData = INITIAL_GRAPH_STATE.graphData;
      newState.graphDataDuration = INITIAL_GRAPH_STATE.graphDataDuration;
      newState.graphDataTimestamp = INITIAL_GRAPH_STATE.graphDataTimestamp;
      newState.summaryData = INITIAL_GRAPH_STATE.summaryData;
      break;
    case getType(GraphActions.changed):
      newState.graphData = INITIAL_GRAPH_STATE.graphData;
      newState.graphDataDuration = INITIAL_GRAPH_STATE.graphDataDuration;
      newState.graphDataTimestamp = INITIAL_GRAPH_STATE.graphDataTimestamp;
      newState.summaryData = INITIAL_GRAPH_STATE.summaryData;
      break;
    case getType(GraphActions.setLayout):
      newState.layout = action.payload;
      break;
    case getType(GraphActions.setNode):
      newState.node = action.payload;
      // TODO: This should be handled in GraphPage.ComponentDidUpdate (Init graph on node change)
      newState.graphData = INITIAL_GRAPH_STATE.graphData;
      newState.graphDataDuration = INITIAL_GRAPH_STATE.graphDataDuration;
      newState.graphDataTimestamp = INITIAL_GRAPH_STATE.graphDataTimestamp;
      newState.summaryData = INITIAL_GRAPH_STATE.summaryData;
      break;
    case getType(GraphActions.updateGraph):
      newState.cyData = {
        updateTimestamp: action.payload.updateTimestamp,
        cyRef: action.payload.cyRef
      };
      break;
    case getType(GraphActions.updateSummary):
      newState.summaryData = {
        summaryType: action.payload.summaryType,
        summaryTarget: action.payload.summaryTarget
      };
      break;
    // Filter actions
    //
    case getType(GraphFilterActions.setEdgelLabelMode):
      newState.filterState.edgeLabelMode = action.payload;
      break;
    case getType(GraphFilterActions.setFindValue):
      newState.filterState.findValue = action.payload;
      break;
    case getType(GraphFilterActions.setGraphType):
      newState.filterState.graphType = action.payload;
      // TODO: This should be handled in GraphPage.ComponentDidUpdate (Init graph on type change)
      newState.graphData = INITIAL_GRAPH_STATE.graphData;
      newState.graphDataDuration = INITIAL_GRAPH_STATE.graphDataDuration;
      newState.graphDataTimestamp = INITIAL_GRAPH_STATE.graphDataTimestamp;
      newState.summaryData = INITIAL_GRAPH_STATE.summaryData;
      break;
    case getType(GraphFilterActions.setHideValue):
      newState.filterState.hideValue = action.payload;
      break;
    case getType(GraphFilterActions.setShowUnusedNodes):
      newState.filterState.showUnusedNodes = action.payload;
      break;
    case getType(GraphFilterActions.toggleFindHelp):
      newState.filterState.showFindHelp = !state.filterState.showFindHelp;
      break;
    case getType(GraphFilterActions.toggleGraphNodeLabel):
      newState.filterState.showNodeLabels = !state.filterState.showNodeLabels;
      break;
    case getType(GraphFilterActions.toggleGraphCircuitBreakers):
      newState.filterState.showCircuitBreakers = !state.filterState.showCircuitBreakers;
      break;
    case getType(GraphFilterActions.toggleGraphVirtualServices):
      newState.filterState.showVirtualServices = !state.filterState.showVirtualServices;
      break;
    case getType(GraphFilterActions.toggleGraphMissingSidecars):
      newState.filterState.showMissingSidecars = !state.filterState.showMissingSidecars;
      break;
    case getType(GraphFilterActions.toggleGraphSecurity):
      newState.filterState.showSecurity = !state.filterState.showSecurity;
      break;
    case getType(GraphFilterActions.toggleLegend):
      newState.filterState.showLegend = !state.filterState.showLegend;
      break;
    case getType(GraphFilterActions.toggleServiceNodes):
      newState.filterState.showServiceNodes = !state.filterState.showServiceNodes;
      // TODO: This should be handled in GraphPage.ComponentDidUpdate (Init graph on serviceNodeschange)
      newState.graphData = INITIAL_GRAPH_STATE.graphData;
      newState.graphDataDuration = INITIAL_GRAPH_STATE.graphDataDuration;
      newState.graphDataTimestamp = INITIAL_GRAPH_STATE.graphDataTimestamp;
      newState.summaryData = INITIAL_GRAPH_STATE.summaryData;
      break;
    case getType(GraphFilterActions.toggleTrafficAnimation):
      newState.filterState.showTrafficAnimation = !state.filterState.showTrafficAnimation;
      break;
    case getType(GraphFilterActions.toggleUnusedNodes):
      newState.filterState.showUnusedNodes = !state.filterState.showUnusedNodes;
      break;
    default:
      break;
  }

  return newState;
};

export default graphDataState;

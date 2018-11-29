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
  isLoading: false,
  isError: false,
  error: undefined,
  graphDataTimestamp: 0,
  graphData: {},
  layout: DagreGraph.getLayout(),
  node: undefined,
  sidePanelInfo: null,
  filterState: {
    edgeLabelMode: EdgeLabelMode.HIDE,
    graphType: GraphType.VERSIONED_APP,
    showCircuitBreakers: true,
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
  let newState: GraphState = {
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
      newState.graphDataTimestamp = action.payload.timestamp;
      newState.graphData = action.payload.graphData;
      break;
    case getType(GraphDataActions.getGraphDataFailure):
      newState.isLoading = false;
      newState.isError = true;
      newState.error = action.payload.error;
      break;
    case getType(GraphActions.setLayout):
      newState.layout = action.payload;
      break;
    case getType(GraphActions.setNode):
      newState.node = action.payload;
      // Init graph on node change
      newState.graphData = INITIAL_GRAPH_STATE.graphData;
      newState.graphDataTimestamp = INITIAL_GRAPH_STATE.graphDataTimestamp;
      newState.sidePanelInfo = INITIAL_GRAPH_STATE.sidePanelInfo;
      break;
    case getType(GraphActions.showSidePanelInfo):
      newState.sidePanelInfo = {
        kind: action.payload.summaryType,
        graphReference: action.payload.summaryTarget
      };
      break;
    case getType(GraphActions.changed):
      newState.graphData = INITIAL_GRAPH_STATE.graphData;
      newState.graphDataTimestamp = INITIAL_GRAPH_STATE.graphDataTimestamp;
      newState.sidePanelInfo = INITIAL_GRAPH_STATE.sidePanelInfo;
      break;
    // Filter actions
    case getType(GraphFilterActions.setEdgelLabelMode):
      newState.filterState.edgeLabelMode = action.payload;
      break;
    case getType(GraphFilterActions.setGraphType):
      newState.filterState.graphType = action.payload;
      // Init graph on graphType change
      newState.graphData = INITIAL_GRAPH_STATE.graphData;
      newState.graphDataTimestamp = INITIAL_GRAPH_STATE.graphDataTimestamp;
      newState.sidePanelInfo = INITIAL_GRAPH_STATE.sidePanelInfo;
      break;
    case getType(GraphFilterActions.toggleLegend):
      newState.filterState.showLegend = !state.filterState.showLegend;
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
    case getType(GraphFilterActions.toggleServiceNodes):
      newState.filterState.showServiceNodes = !state.filterState.showServiceNodes;
      // Init graph on serviceNodeschange
      newState.graphData = INITIAL_GRAPH_STATE.graphData;
      newState.graphDataTimestamp = INITIAL_GRAPH_STATE.graphDataTimestamp;
      newState.sidePanelInfo = INITIAL_GRAPH_STATE.sidePanelInfo;
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

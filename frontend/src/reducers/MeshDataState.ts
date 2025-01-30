import { getType } from 'typesafe-actions';
import { KialiAppAction } from '../actions/KialiAppAction';
import { MeshState } from '../store/Store';
import { updateState } from '../utils/Reducer';
import { MeshActions } from 'actions/MeshActions';
import { MeshToolbarActions } from 'actions/MeshToolbarActions';
import { KialiDagreGraph } from 'components/CytoscapeGraph/graphs/KialiDagreGraph';

export const INITIAL_MESH_STATE: MeshState = {
  definition: null,
  layout: KialiDagreGraph.getLayout(),
  target: null,
  toolbarState: {
    findValue: '',
    hideValue: '',
    showFindHelp: false,
    showGateways: false,
    showLegend: false,
    showWaypoints: false
  },
  updateTime: 0
};

// This Reducer allows changes to the 'graphDataState' portion of Redux Store
export const MeshDataStateReducer = (state: MeshState = INITIAL_MESH_STATE, action: KialiAppAction): MeshState => {
  switch (action.type) {
    case getType(MeshActions.setDefinition):
      return updateState(state, { definition: action.payload });
    case getType(MeshActions.setLayout):
      return updateState(state, { layout: action.payload });
    case getType(MeshActions.setTarget):
      return updateState(state, {
        target: updateState(state.target, {
          elem: action.payload.elem,
          type: action.payload.type
        })
      });
    case getType(MeshActions.setUpdateTime):
      return updateState(state, {
        updateTime: action.payload
      });
    // Filter actions
    //
    case getType(MeshToolbarActions.setFindValue):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          findValue: action.payload
        })
      });
    case getType(MeshToolbarActions.setHideValue):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          hideValue: action.payload
        })
      });
    case getType(MeshToolbarActions.resetSettings):
      return updateState(state, {
        toolbarState: INITIAL_MESH_STATE.toolbarState
      });
    case getType(MeshToolbarActions.toggleFindHelp):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showFindHelp: !state.toolbarState.showFindHelp
        })
      });
    case getType(MeshToolbarActions.toggleGateways):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showGateways: !state.toolbarState.showGateways
        })
      });
    case getType(MeshToolbarActions.toggleLegend):
      return updateState(state, {
        toolbarState: updateState(state.toolbarState, {
          showLegend: !state.toolbarState.showLegend
        })
      });
    case getType(MeshToolbarActions.toggleWaypoints):
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

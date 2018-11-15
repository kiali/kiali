import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { CytoscapeClickEvent } from '../types/Graph';

enum GraphActionKeys {
  GRAPH_CHANGED = 'GRAPH_CHANGED',
  GRAPH_SIDE_PANEL_SHOW_INFO = 'GRAPH_SIDE_PANEL_SHOW_INFO'
}

export const GraphActions = {
  changed: createAction(GraphActionKeys.GRAPH_CHANGED),
  showSidePanelInfo: createStandardAction(GraphActionKeys.GRAPH_SIDE_PANEL_SHOW_INFO)<CytoscapeClickEvent>()
};

export const GraphThunkActions = {
  graphRendered: (cy: any) => {
    return dispatch => {
      dispatch(
        GraphActions.showSidePanelInfo({
          summaryType: 'graph',
          summaryTarget: cy
        })
      );
    };
  }
};

export type GraphAction = ActionType<typeof GraphActions>;

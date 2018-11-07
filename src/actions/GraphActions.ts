import { createAction } from 'typesafe-actions';
import { CytoscapeClickEvent } from '../types/Graph';

export enum GraphActionKeys {
  GRAPH_CHANGED = 'GRAPH_CHANGED',
  GRAPH_SIDE_PANEL_SHOW_INFO = 'GRAPH_SIDE_PANEL_SHOW_INFO'
}

export const GraphActions = {
  changed: createAction(GraphActionKeys.GRAPH_CHANGED, () => ({
    type: GraphActionKeys.GRAPH_CHANGED
  })),
  showSidePanelInfo: createAction(GraphActionKeys.GRAPH_SIDE_PANEL_SHOW_INFO, (event: CytoscapeClickEvent) => ({
    type: GraphActionKeys.GRAPH_SIDE_PANEL_SHOW_INFO,
    ...event
  })),
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

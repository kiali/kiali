import { createAction } from 'typesafe-actions';
import { CytoscapeClickEvent } from '../types/Graph';

export enum GraphActionKeys {
  GRAPH_SIDE_PANEL_SHOW_INFO = 'GRAPH_SIDE_PANEL_SHOW_INFO'
}

// synchronous action creators
export const GraphActions = {
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

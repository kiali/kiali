import { createAction } from 'typesafe-actions';
import { CytoscapeClickEvent } from '../types/Graph';

export enum GraphActionKeys {
  GRAPH_NAMESPACE_CHANGED = 'GRAPH_NAMESPACE_CHANGED',
  GRAPH_SIDE_PANEL_SHOW_INFO = 'GRAPH_SIDE_PANEL_SHOW_INFO'
}

// synchronous action creators
export const GraphActions = {
  namespaceChanged: createAction(GraphActionKeys.GRAPH_NAMESPACE_CHANGED, (newNamespace: string) => ({
    type: GraphActionKeys.GRAPH_NAMESPACE_CHANGED,
    newNamespace
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

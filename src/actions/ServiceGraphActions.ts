import { createAction } from 'typesafe-actions';
import { CytoscapeClickEvent } from '../components/CytoscapeGraph/CytoscapeGraph';

export enum ServiceGraphActionKeys {
  SERVICE_GRAPH_SIDE_PANEL_SHOW_INFO = 'SERVICE_GRAPH_SIDE_PANEL_SHOW_INFO'
}

// synchronous action creators
export const ServiceGraphActions = {
  showSidePanelInfo: createAction(
    ServiceGraphActionKeys.SERVICE_GRAPH_SIDE_PANEL_SHOW_INFO,
    (event: CytoscapeClickEvent) => ({
      type: ServiceGraphActionKeys.SERVICE_GRAPH_SIDE_PANEL_SHOW_INFO,
      ...event
    })
  ),
  graphRendered: (cy: any) => {
    return dispatch => {
      dispatch(
        ServiceGraphActions.showSidePanelInfo({
          summaryType: 'graph',
          summaryTarget: cy
        })
      );
    };
  }
};

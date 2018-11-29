import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { CytoscapeClickEvent, NodeParamsType } from '../types/Graph';
import { Layout } from '../types/GraphFilter';

enum GraphActionKeys {
  GRAPH_CHANGED = 'GRAPH_CHANGED',
  GRAPH_SIDE_PANEL_SHOW_INFO = 'GRAPH_SIDE_PANEL_SHOW_INFO',
  SET_LAYOUT = 'SET_LAYOUT',
  SET_NODE = 'SET_NODE'
}

export const GraphActions = {
  changed: createAction(GraphActionKeys.GRAPH_CHANGED),
  setLayout: createStandardAction(GraphActionKeys.SET_LAYOUT)<Layout>(),
  setNode: createStandardAction(GraphActionKeys.SET_NODE)<NodeParamsType>(),
  showSidePanelInfo: createStandardAction(GraphActionKeys.GRAPH_SIDE_PANEL_SHOW_INFO)<CytoscapeClickEvent>()
};

export type GraphAction = ActionType<typeof GraphActions>;

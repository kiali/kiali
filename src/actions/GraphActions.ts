import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { CyData, CytoscapeClickEvent, NodeParamsType } from '../types/Graph';
import { Layout } from '../types/GraphFilter';

enum GraphActionKeys {
  CHANGED = 'CHANGED',
  SET_LAYOUT = 'SET_LAYOUT',
  SET_NODE = 'SET_NODE',
  UPDATE_GRAPH = 'UPDATE_GRAPH',
  UPDATE_SUMMARY = 'UPDATE_SUMMARY'
}

export const GraphActions = {
  changed: createAction(GraphActionKeys.CHANGED),
  setLayout: createStandardAction(GraphActionKeys.SET_LAYOUT)<Layout>(),
  setNode: createStandardAction(GraphActionKeys.SET_NODE)<NodeParamsType>(),
  updateGraph: createStandardAction(GraphActionKeys.UPDATE_GRAPH)<CyData>(),
  updateSummary: createStandardAction(GraphActionKeys.UPDATE_SUMMARY)<CytoscapeClickEvent>()
};

export type GraphAction = ActionType<typeof GraphActions>;

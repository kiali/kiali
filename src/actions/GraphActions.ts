import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { CyData, CytoscapeClickEvent, NodeParamsType } from '../types/Graph';
import { Layout } from '../types/GraphFilter';
import { ActionKeys } from './ActionKeys';

export const GraphActions = {
  changed: createAction(ActionKeys.GRAPH_CHANGED),
  setLayout: createStandardAction(ActionKeys.GRAPH_SET_LAYOUT)<Layout>(),
  setNode: createStandardAction(ActionKeys.GRAPH_SET_NODE)<NodeParamsType | undefined>(),
  updateGraph: createStandardAction(ActionKeys.UPDATE_GRAPH)<CyData>(),
  updateSummary: createStandardAction(ActionKeys.UPDATE_SUMMARY)<CytoscapeClickEvent>()
};

export type GraphAction = ActionType<typeof GraphActions>;

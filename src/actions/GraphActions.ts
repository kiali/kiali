import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { CytoscapeClickEvent, Layout, NodeParamsType } from '../types/Graph';
import { ActionKeys } from './ActionKeys';
import { TimeInMilliseconds } from 'types/Common';

export const GraphActions = {
  onNamespaceChange: createAction(ActionKeys.GRAPH_ON_NAMESPACE_CHANGE),
  setLayout: createStandardAction(ActionKeys.GRAPH_SET_LAYOUT)<Layout>(),
  setNode: createStandardAction(ActionKeys.GRAPH_SET_NODE)<NodeParamsType | undefined>(),
  setUpdateTime: createStandardAction(ActionKeys.GRAPH_SET_UPDATE_TIME)<TimeInMilliseconds>(),
  updateSummary: createStandardAction(ActionKeys.GRAPH_UPDATE_SUMMARY)<CytoscapeClickEvent>()
};

export type GraphAction = ActionType<typeof GraphActions>;

import { ActionType, createStandardAction } from 'typesafe-actions';
import { SummaryData, EdgeMode, GraphDefinition, NodeParamsType, RankResult, GraphLayout } from '../types/Graph';
import { ActionKeys } from './ActionKeys';
import { TimeInMilliseconds } from 'types/Common';

export const GraphActions = {
  setEdgeMode: createStandardAction(ActionKeys.GRAPH_SET_EDGE_MODE)<EdgeMode>(),
  setGraphDefinition: createStandardAction(ActionKeys.GRAPH_SET_DEFINITION)<GraphDefinition>(),
  setLayout: createStandardAction(ActionKeys.GRAPH_SET_LAYOUT)<GraphLayout>(),
  setNamespaceLayout: createStandardAction(ActionKeys.GRAPH_SET_NAMESPACE_LAYOUT)<GraphLayout>(),
  setNode: createStandardAction(ActionKeys.GRAPH_SET_NODE)<NodeParamsType | undefined>(),
  setRankResult: createStandardAction(ActionKeys.GRAPH_SET_RANK_RESULT)<RankResult>(),
  setUpdateTime: createStandardAction(ActionKeys.GRAPH_SET_UPDATE_TIME)<TimeInMilliseconds>(),
  updateSummary: createStandardAction(ActionKeys.GRAPH_UPDATE_SUMMARY)<SummaryData | null>()
};

export type GraphAction = ActionType<typeof GraphActions>;

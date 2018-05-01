// Action Creators allow us to create typesafe utilities for dispatching actions
import { createAction } from 'typesafe-actions';

export enum ServiceGraphActionsType {
  TOGGLE_GRAPH_NODE_LABEL = 'TOGGLE_GRAPH_NODE_LABEL',
  TOGGLE_GRAPH_EDGE_LABEL = 'TOGGLE_GRAPH_EDGE_LABEL'
}

export const serviceGraphActions = {
  toggleGraphNodeLabel: createAction(ServiceGraphActionsType.TOGGLE_GRAPH_NODE_LABEL),
  toggleGraphEdgeLabel: createAction(ServiceGraphActionsType.TOGGLE_GRAPH_EDGE_LABEL)
  // add: createAction('ADD', (amount: number) => ({
  //   type: 'ADD',
  //   payload: amount,
  // })),
};

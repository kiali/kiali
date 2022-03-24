import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import Namespace from '../types/Namespace';
import { ActionKeys } from './ActionKeys';

export const NamespaceActions = {
  toggleActiveNamespace: createStandardAction(ActionKeys.TOGGLE_ACTIVE_NAMESPACE)<Namespace>(),
  setActiveNamespaces: createStandardAction(ActionKeys.SET_ACTIVE_NAMESPACES)<Namespace[]>(),
  setFilter: createStandardAction(ActionKeys.NAMESPACE_SET_FILTER)<string>(),
  requestStarted: createAction(ActionKeys.NAMESPACE_REQUEST_STARTED),
  requestFailed: createAction(ActionKeys.NAMESPACE_FAILED),
  receiveList: createAction(ActionKeys.NAMESPACE_SUCCESS, resolve => (newList: Namespace[], receivedAt: Date) =>
    resolve({
      list: newList,
      receivedAt: receivedAt
    })
  )
};

export type NamespaceAction = ActionType<typeof NamespaceActions>;

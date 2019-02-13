import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import Namespace from '../types/Namespace';

enum NamespaceActionKeys {
  NAMESPACE_REQUEST_STARTED = 'NAMESPACE_REQUEST_STARTED',
  NAMESPACE_SUCCESS = 'NAMESPACE_SUCCESS',
  NAMESPACE_FAILED = 'NAMESPACE_FAILED',
  TOGGLE_ACTIVE_NAMESPACE = 'TOGGLE_ACTIVE_NAMESPACE',
  SET_ACTIVE_NAMESPACES = 'SET_ACTIVE_NAMESPACES',
  SET_FILTER = 'SET_FILTER'
}

export const NamespaceActions = {
  toggleActiveNamespace: createStandardAction(NamespaceActionKeys.TOGGLE_ACTIVE_NAMESPACE)<Namespace>(),
  setActiveNamespaces: createStandardAction(NamespaceActionKeys.SET_ACTIVE_NAMESPACES)<Namespace[]>(),
  setFilter: createStandardAction(NamespaceActionKeys.SET_FILTER)<string>(),
  requestStarted: createAction(NamespaceActionKeys.NAMESPACE_REQUEST_STARTED),
  requestFailed: createAction(NamespaceActionKeys.NAMESPACE_FAILED),
  receiveList: createAction(
    NamespaceActionKeys.NAMESPACE_SUCCESS,
    resolve => (newList: Namespace[], receivedAt: Date) =>
      resolve({
        list: newList,
        receivedAt: receivedAt
      })
  )
};

export type NamespaceAction = ActionType<typeof NamespaceActions>;

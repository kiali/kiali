import * as Api from '../services/Api';
import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import Namespace from '../types/Namespace';
import { KialiAppState } from '../store/Store';

enum NamespaceActionKeys {
  NAMESPACE_REQUEST_STARTED = 'NAMESPACE_REQUEST_STARTED',
  NAMESPACE_SUCCESS = 'NAMESPACE_SUCCESS',
  NAMESPACE_FAILED = 'NAMESPACE_FAILED',
  TOGGLE_ACTIVE_NAMESPACE = 'TOGGLE_ACTIVE_NAMESPACE',
  SET_ACTIVE_NAMESPACES = 'SET_ACTIVE_NAMESPACES'
}

const shouldFetchNamespaces = (state: KialiAppState) => {
  if (!state) {
    return true;
  } else {
    return !state.namespaces.isFetching;
  }
};

export const NamespaceActions = {
  toggleActiveNamespace: createStandardAction(NamespaceActionKeys.TOGGLE_ACTIVE_NAMESPACE)<Namespace>(),
  setActiveNamespaces: createStandardAction(NamespaceActionKeys.SET_ACTIVE_NAMESPACES)<Namespace[]>(),
  requestStarted: createAction(NamespaceActionKeys.NAMESPACE_REQUEST_STARTED),
  requestFailed: createAction(NamespaceActionKeys.NAMESPACE_FAILED),
  receiveList: createAction(NamespaceActionKeys.NAMESPACE_SUCCESS, resolve => (newList: any, receivedAt: Date) =>
    resolve({
      list: newList,
      receivedAt: receivedAt
    })
  )
};

export const NamespaceThunkActions = {
  asyncFetchNamespaces: (auth: any) => {
    return dispatch => {
      dispatch(NamespaceActions.requestStarted());
      return Api.getNamespaces(auth)
        .then(response => response['data'])
        .then(data => {
          let namespaceList: Namespace[] = [{ name: 'all' }];
          data.forEach((aNamespace: Namespace) => {
            namespaceList.push(aNamespace);
          });
          dispatch(NamespaceActions.receiveList(namespaceList, new Date()));
        })
        .catch(() => dispatch(NamespaceActions.requestFailed()));
    };
  },

  fetchNamespacesIfNeeded: () => {
    // Note that the function also receives getState()
    // which lets you choose what to dispatch next.
    // This is useful for avoiding a network request if
    // a cached value is already available.
    return (dispatch, getState) => {
      if (shouldFetchNamespaces(getState())) {
        if (getState()['authentication']['token'] === undefined) {
          return Promise.resolve();
        }
        const auth = 'Bearer ' + getState().authentication.token.token;
        // Dispatch a thunk from thunk!
        return dispatch(NamespaceThunkActions.asyncFetchNamespaces(auth));
      } else {
        // Let the calling code know there's nothing to wait for.
        return Promise.resolve();
      }
    };
  }
};

export type NamespaceAction = ActionType<typeof NamespaceActions>;

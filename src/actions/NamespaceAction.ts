import * as Api from '../services/Api';
import { createAction } from 'typesafe-actions';
import Namespace from '../types/Namespace';
import { KialiAppState } from '../store/Store';
import { JsonString } from '../types/Common';

export enum NamespaceActionKeys {
  NAMESPACE_REQUEST_STARTED = 'NAMESPACE_REQUEST_STARTED',
  NAMESPACE_SUCCESS = 'NAMESPACE_SUCCESS',
  NAMESPACE_FAILED = 'NAMESPACE_FAILED',
  SET_ACTIVE_NAMESPACE = 'SET_ACTIVE_NAMESPACE',
  SET_PREVIOUS_GRAPH_STATE = 'SET_PREVIOUS_GRAPH_STATE'
}

const shouldFetchNamespaces = (state: KialiAppState) => {
  if (!state) {
    return true;
  } else {
    return !state.namespaces.isFetching;
  }
};

export const NamespaceActions = {
  setActiveNamespace: createAction(NamespaceActionKeys.SET_ACTIVE_NAMESPACE, (namespace: Namespace) => ({
    type: NamespaceActionKeys.SET_ACTIVE_NAMESPACE,
    payload: namespace
  })),
  setPreviousGraphState: createAction(NamespaceActionKeys.SET_PREVIOUS_GRAPH_STATE, (state: JsonString) => ({
    type: NamespaceActionKeys.SET_PREVIOUS_GRAPH_STATE,
    payload: state
  })),
  requestStarted: createAction(NamespaceActionKeys.NAMESPACE_REQUEST_STARTED),
  requestFailed: createAction(NamespaceActionKeys.NAMESPACE_FAILED),
  receiveList: createAction(NamespaceActionKeys.NAMESPACE_SUCCESS, (newList: any, receivedAt: Date) => ({
    type: NamespaceActionKeys.NAMESPACE_SUCCESS,
    list: newList,
    receivedAt: receivedAt
  })),
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
        return dispatch(NamespaceActions.asyncFetchNamespaces(auth));
      } else {
        // Let the calling code know there's nothing to wait for.
        return Promise.resolve();
      }
    };
  }
};

import { KialiAppState } from '../store/Store';
import * as Api from '../services/Api';
import { KialiDispatch } from '../types/Redux';
import { NamespaceActions } from './NamespaceAction';

const shouldFetchNamespaces = (state: KialiAppState) => {
  if (!state) {
    return true;
  } else {
    return !state.namespaces.isFetching;
  }
};

export const NamespaceThunkActions = {
  asyncFetchNamespaces: () => {
    return (dispatch: KialiDispatch) => {
      dispatch(NamespaceActions.requestStarted());
      return Api.getNamespaces()
        .then(response => response.data)
        .then(data => {
          dispatch(NamespaceActions.receiveList([...data], new Date()));
        })
        .catch(() => dispatch(NamespaceActions.requestFailed()));
    };
  },

  fetchNamespacesIfNeeded: () => {
    // Note that the function also receives getState()
    // which lets you choose what to dispatch next.
    // This is useful for avoiding a network request if
    // a cached value is already available.
    return (dispatch: KialiDispatch, getState: () => KialiAppState) => {
      if (shouldFetchNamespaces(getState())) {
        const state = getState().authentication;

        if (!state || !state.session) {
          return Promise.resolve();
        }

        // Dispatch a thunk from thunk!
        return dispatch(NamespaceThunkActions.asyncFetchNamespaces());
      } else {
        // Let the calling code know there's nothing to wait for.
        return Promise.resolve();
      }
    };
  }
};

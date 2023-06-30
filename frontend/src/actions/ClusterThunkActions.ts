import { KialiAppState } from '../store/Store';
import * as Api from '../services/Api';
import { KialiDispatch } from '../types/Redux';
import { ClusterActions } from './ClusterAction';
import { filterDuplicateClusters } from '../reducers/ClusterState';

const shouldFetchClusters = (state: KialiAppState) => {
  if (!state) {
    return true;
  } else {
    return !state.clusters.isFetching;
  }
};

export const ClusterThunkActions = {
  asyncFetchClusters: () => {
    return (dispatch: KialiDispatch) => {
      dispatch(ClusterActions.requestStarted());
      return Api.getNamespaces()
        .then(response => response.data)
        .then(data => {
          dispatch(ClusterActions.receiveList(filterDuplicateClusters([...data]), new Date()));
        })
        .catch(() => dispatch(ClusterActions.requestFailed()));
    };
  },

  fetchClustersIfNeeded: () => {
    // Note that the function also receives getState()
    // which lets you choose what to dispatch next.
    // This is useful for avoiding a network request if
    // a cached value is already available.
    return (dispatch: KialiDispatch, getState: () => KialiAppState) => {
      if (shouldFetchClusters(getState())) {
        const state = getState().authentication;

        if (!state || !state.session) {
          return Promise.resolve();
        }

        // Dispatch a thunk from thunk!
        return dispatch(ClusterThunkActions.asyncFetchClusters());
      } else {
        // Let the calling code know there's nothing to wait for.
        return Promise.resolve();
      }
    };
  }
};

import * as Api from '../services/Api';

export enum NamespaceActionType {
  RELOAD = 'reload',
  API_INITIATE_REQUEST = 'api_initiate_request',
  API_RECEIVE_LIST = 'api_receive_list'
}

export const reload = () => {
  return {
    type: NamespaceActionType.RELOAD
  };
};

export const apiInitiateRequest = () => {
  return {
    type: NamespaceActionType.API_INITIATE_REQUEST
  };
};

export const apiReceiveList = newList => {
  return {
    type: NamespaceActionType.API_RECEIVE_LIST,
    list: newList,
    receivedAt: Date.now()
  };
};

export const asyncFetchNamespaces = () => {
  return dispatch => {
    dispatch(apiInitiateRequest());
    return Api.GetNamespaces()
      .then(response => response['data'])
      .then(data => dispatch(apiReceiveList(data)));
  };
};

const shouldFetchNamespaces = state => {
  if (!state) {
    return true;
  } else if (state.namespaces.isFetching) {
    return false;
  } else {
    return true;
  }
};

export const fetchNamespacesIfNeeded = () => {
  // Note that the function also receives getState()
  // which lets you choose what to dispatch next.
  // This is useful for avoiding a network request if
  // a cached value is already available.
  return (dispatch, getState) => {
    console.log('fetchNamespacesIfNeeded()');
    if (shouldFetchNamespaces(getState())) {
      console.log('begin async fetching namespaces');
      // Dispatch a thunk from thunk!
      return dispatch(asyncFetchNamespaces());
    } else {
      // Let the calling code know there's nothing to wait for.
      return Promise.resolve();
    }
  };
};

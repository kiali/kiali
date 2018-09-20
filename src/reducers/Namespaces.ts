import { NamespaceActionKeys } from '../actions/NamespaceAction';

export const INITIAL_NAMESPACE_STATE = {
  isFetching: false,
  items: [] as Array<string>
};

const namespaces = (state = INITIAL_NAMESPACE_STATE, action) => {
  switch (action.type) {
    case NamespaceActionKeys.NAMESPACE_REQUEST_STARTED:
      return Object.assign({}, state, {
        isFetching: true
      });

    case NamespaceActionKeys.NAMESPACE_SUCCESS:
      return Object.assign({}, state, {
        isFetching: false,
        items: action.list,
        lastUpdated: action.receivedAt
      });
    case NamespaceActionKeys.NAMESPACE_FAILED:
      return Object.assign({}, state, {
        isFetching: false
      });
    default:
      return state;
  }
};

export default namespaces;

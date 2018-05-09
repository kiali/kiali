import { NamespaceActionType } from '../actions/NamespaceAction';

const INITIAL_STATE = {
  isFetching: false,
  didInvalidate: false,
  items: []
};

const namespaces = (state = INITIAL_STATE, action) => {
  switch (action.type) {
    case NamespaceActionType.RELOAD:
      return Object.assign({}, state, {
        didInvalidate: true
      });

    case NamespaceActionType.API_INITIATE_REQUEST:
      return Object.assign({}, state, {
        isFetching: true,
        didInvalidate: false
      });

    case NamespaceActionType.API_RECEIVE_LIST:
      return Object.assign({}, state, {
        isFetching: false,
        didInvalidate: false,
        items: action.list,
        lastUpdated: action.receivedAt
      });

    default:
      return state;
  }
};

export default namespaces;

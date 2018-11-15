import { getType } from 'typesafe-actions';
import { updateState } from '../utils/Reducer';
import { NamespaceState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { NamespaceActions } from '../actions/NamespaceAction';

export const INITIAL_NAMESPACE_STATE: NamespaceState = {
  activeNamespace: { name: 'all' },
  isFetching: false,
  items: ['all'],
  lastUpdated: undefined
};

const namespaces = (state: NamespaceState = INITIAL_NAMESPACE_STATE, action: KialiAppAction): NamespaceState => {
  switch (action.type) {
    case getType(NamespaceActions.setActiveNamespace):
      return updateState(state, {
        activeNamespace: { name: action.payload.name }
      });

    case getType(NamespaceActions.requestStarted):
      return updateState(state, {
        isFetching: true
      });

    case getType(NamespaceActions.receiveList):
      return updateState(state, {
        isFetching: false,
        items: action.payload.list,
        lastUpdated: action.payload.receivedAt
      });

    case getType(NamespaceActions.requestFailed):
      return updateState(state, {
        isFetching: false
      });

    default:
      return state;
  }
};

export default namespaces;

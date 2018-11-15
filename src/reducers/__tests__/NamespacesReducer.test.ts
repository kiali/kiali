import namespaceState from '../NamespaceState';
import { GlobalActions } from '../../actions/GlobalActions';
import { NamespaceActions } from '../../actions/NamespaceAction';

describe('Namespaces reducer', () => {
  it('should return the initial state', () => {
    expect(namespaceState(undefined, GlobalActions.nil())).toEqual({
      isFetching: false,
      activeNamespace: { name: 'all' },
      items: ['all'],
      lastUpdated: undefined
    });
  });

  it('should handle ACTIVE_NAMESPACE', () => {
    const currentState = {
      activeNamespace: { name: 'all' },
      isFetching: false,
      items: [],
      lastUpdated: undefined
    };
    const requestStartedAction = NamespaceActions.setActiveNamespace({ name: 'istio' });
    const expectedState = {
      activeNamespace: { name: 'istio' },
      isFetching: false,
      items: [],
      lastUpdated: undefined
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle NAMESPACE_REQUEST_STARTED', () => {
    const currentState = {
      activeNamespace: { name: 'all' },
      isFetching: false,
      items: [],
      lastUpdated: undefined
    };
    const requestStartedAction = NamespaceActions.requestStarted();
    const expectedState = {
      activeNamespace: { name: 'all' },
      isFetching: true,
      items: [],
      lastUpdated: undefined
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle NAMESPACE_FAILED', () => {
    const currentState = {
      activeNamespace: { name: 'all' },
      isFetching: true,
      items: []
    };
    const requestStartedAction = NamespaceActions.requestFailed();
    const expectedState = {
      activeNamespace: { name: 'all' },
      isFetching: false,
      items: []
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle NAMESPACE_SUCCESS', () => {
    const currentDate = new Date();
    const currentState = {
      activeNamespace: { name: 'all' },
      isFetching: true,
      items: ['old', 'namespace'],
      lastUpdated: undefined
    };
    const requestStartedAction = NamespaceActions.receiveList(['a', 'b', 'c'], currentDate);
    const expectedState = {
      activeNamespace: { name: 'all' },
      isFetching: false,
      items: ['a', 'b', 'c'],
      lastUpdated: currentDate
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });
});

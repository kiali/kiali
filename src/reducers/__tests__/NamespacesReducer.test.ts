import namespaceState from '../NamespaceState';
import { GlobalActions } from '../../actions/GlobalActions';
import { NamespaceActions } from '../../actions/NamespaceAction';

describe('Namespaces reducer', () => {
  it('should return the initial state', () => {
    expect(namespaceState(undefined, GlobalActions.unknown())).toEqual({
      isFetching: false,
      activeNamespaces: [{ name: 'all' }],
      items: [],
      lastUpdated: undefined
    });
  });

  it('should handle ACTIVE_NAMESPACES', () => {
    const currentState = {
      activeNamespaces: [{ name: 'my-namespace' }],
      isFetching: false,
      items: [],
      lastUpdated: undefined
    };
    const requestStartedAction = NamespaceActions.setActiveNamespaces([{ name: 'istio' }]);
    const expectedState = {
      activeNamespaces: [{ name: 'istio' }],
      isFetching: false,
      items: [],
      lastUpdated: undefined
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle TOGGLE_NAMESPACE to remove a namespace', () => {
    const currentState = {
      activeNamespaces: [{ name: 'my-namespace' }, { name: 'my-namespace-2' }],
      isFetching: false,
      items: [],
      lastUpdated: undefined
    };
    const requestStartedAction = NamespaceActions.toggleActiveNamespace({ name: 'my-namespace' });
    const expectedState = {
      activeNamespaces: [{ name: 'my-namespace-2' }],
      isFetching: false,
      items: [],
      lastUpdated: undefined
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle TOGGLE_NAMESPACE to add a namespace', () => {
    const currentState = {
      activeNamespaces: [{ name: 'my-namespace' }, { name: 'my-namespace-2' }],
      isFetching: false,
      items: [],
      lastUpdated: undefined
    };
    const requestStartedAction = NamespaceActions.toggleActiveNamespace({ name: 'my-namespace-3' });
    const expectedState = {
      activeNamespaces: [{ name: 'my-namespace' }, { name: 'my-namespace-2' }, { name: 'my-namespace-3' }],
      isFetching: false,
      items: [],
      lastUpdated: undefined
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle NAMESPACE_REQUEST_STARTED', () => {
    const currentState = {
      activeNamespaces: [{ name: 'my-namespace' }],
      isFetching: false,
      items: [],
      lastUpdated: undefined
    };
    const requestStartedAction = NamespaceActions.requestStarted();
    const expectedState = {
      activeNamespaces: [{ name: 'my-namespace' }],
      isFetching: true,
      items: [],
      lastUpdated: undefined
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle NAMESPACE_FAILED', () => {
    const currentState = {
      activeNamespaces: [{ name: 'my-namespace' }],
      isFetching: true,
      items: []
    };
    const requestStartedAction = NamespaceActions.requestFailed();
    const expectedState = {
      activeNamespaces: [{ name: 'my-namespace' }],
      isFetching: false,
      items: []
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle NAMESPACE_SUCCESS', () => {
    const currentDate = new Date();
    const currentState = {
      activeNamespaces: [{ name: 'my-namespace' }],
      isFetching: true,
      items: [{ name: 'old' }, { name: 'namespace' }],
      lastUpdated: undefined
    };
    const requestStartedAction = NamespaceActions.receiveList(
      [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
      currentDate
    );
    const expectedState = {
      activeNamespaces: [{ name: 'my-namespace' }],
      isFetching: false,
      items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
      lastUpdated: currentDate
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });
});

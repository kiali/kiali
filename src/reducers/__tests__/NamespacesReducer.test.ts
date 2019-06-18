import namespaceState from '../NamespaceState';
import { GlobalActions } from '../../actions/GlobalActions';
import { NamespaceActions } from '../../actions/NamespaceAction';

describe('Namespaces reducer', () => {
  it('should return the initial state', () => {
    expect(namespaceState(undefined, GlobalActions.unknown())).toEqual({
      isFetching: false,
      activeNamespaces: [],
      items: [],
      lastUpdated: undefined,
      filter: ''
    });
  });

  it('should handle ACTIVE_NAMESPACES', () => {
    const currentState = {
      activeNamespaces: [{ name: 'my-namespace' }],
      isFetching: false,
      items: [],
      lastUpdated: undefined,
      filter: ''
    };
    const requestStartedAction = NamespaceActions.setActiveNamespaces([{ name: 'istio' }]);
    const expectedState = {
      activeNamespaces: [{ name: 'istio' }],
      isFetching: false,
      items: [],
      lastUpdated: undefined,
      filter: ''
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle SET_FILTER', () => {
    const currentState = {
      activeNamespaces: [{ name: 'my-namespace' }],
      isFetching: false,
      items: [],
      lastUpdated: undefined,
      filter: ''
    };
    const requestStartedAction = NamespaceActions.setFilter('istio');
    const expectedState = {
      activeNamespaces: [{ name: 'my-namespace' }],
      isFetching: false,
      items: [],
      lastUpdated: undefined,
      filter: 'istio'
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle TOGGLE_NAMESPACE to remove a namespace', () => {
    const currentState = {
      activeNamespaces: [{ name: 'my-namespace' }, { name: 'my-namespace-2' }],
      isFetching: false,
      items: [],
      lastUpdated: undefined,
      filter: ''
    };
    const requestStartedAction = NamespaceActions.toggleActiveNamespace({ name: 'my-namespace' });
    const expectedState = {
      activeNamespaces: [{ name: 'my-namespace-2' }],
      isFetching: false,
      items: [],
      lastUpdated: undefined,
      filter: ''
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle TOGGLE_NAMESPACE to add a namespace', () => {
    const currentState = {
      activeNamespaces: [{ name: 'my-namespace' }, { name: 'my-namespace-2' }],
      isFetching: false,
      items: [],
      lastUpdated: undefined,
      filter: ''
    };
    const requestStartedAction = NamespaceActions.toggleActiveNamespace({ name: 'my-namespace-3' });
    const expectedState = {
      activeNamespaces: [{ name: 'my-namespace' }, { name: 'my-namespace-2' }, { name: 'my-namespace-3' }],
      isFetching: false,
      items: [],
      lastUpdated: undefined,
      filter: ''
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle NAMESPACE_REQUEST_STARTED', () => {
    const currentState = {
      activeNamespaces: [{ name: 'my-namespace' }],
      isFetching: false,
      items: [],
      lastUpdated: undefined,
      filter: ''
    };
    const requestStartedAction = NamespaceActions.requestStarted();
    const expectedState = {
      activeNamespaces: [{ name: 'my-namespace' }],
      isFetching: true,
      items: [],
      lastUpdated: undefined,
      filter: ''
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle NAMESPACE_FAILED', () => {
    const currentState = {
      activeNamespaces: [{ name: 'my-namespace' }],
      isFetching: true,
      items: [],
      filter: ''
    };
    const requestStartedAction = NamespaceActions.requestFailed();
    const expectedState = {
      activeNamespaces: [{ name: 'my-namespace' }],
      isFetching: false,
      items: [],
      filter: ''
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle NAMESPACE_SUCCESS', () => {
    const currentDate = new Date();
    const currentState = {
      activeNamespaces: [{ name: 'my-namespace' }],
      isFetching: true,
      items: [{ name: 'old' }, { name: 'my-namespace' }],
      lastUpdated: undefined,
      filter: ''
    };
    const requestStartedAction = NamespaceActions.receiveList(
      [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
      currentDate
    );
    const expectedState = {
      activeNamespaces: [],
      isFetching: false,
      items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
      lastUpdated: currentDate,
      filter: ''
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });
});

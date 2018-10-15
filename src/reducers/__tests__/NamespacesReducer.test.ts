// import { NamespaceActionKeys } from '../../actions/NamespaceAction';
import namespaceState from '../NamespaceState';
import { NamespaceActionKeys } from '../../actions/NamespaceAction';

describe('Namespaces reducer', () => {
  it('should return the initial state', () => {
    expect(namespaceState(undefined, {})).toEqual({
      isFetching: false,
      activeNamespace: { name: 'all' },
      previousGraphState: undefined,
      items: ['all'],
      lastUpdated: undefined
    });
  });

  it('should handle ACTIVE_NAMESPACE', () => {
    const currentState = {
      activeNamespace: { name: 'all' },
      previousGraphState: undefined,
      isFetching: false,
      items: [],
      lastUpdated: undefined
    };
    const requestStartedAction = {
      type: NamespaceActionKeys.SET_ACTIVE_NAMESPACE,
      payload: { name: 'istio' }
    };
    const expectedState = {
      activeNamespace: { name: 'istio' },
      previousGraphState: undefined,
      isFetching: false,
      items: [],
      lastUpdated: undefined
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle PREVIOUS_GRAPH_STATE', () => {
    const currentState = {
      activeNamespace: { name: 'all' },
      previousGraphState: undefined,
      isFetching: false,
      items: [],
      lastUpdated: undefined
    };
    const requestStartedAction = {
      type: NamespaceActionKeys.SET_PREVIOUS_GRAPH_STATE,
      payload: 'abc'
    };
    const expectedState = {
      activeNamespace: { name: 'all' },
      previousGraphState: 'abc',
      isFetching: false,
      items: [],
      lastUpdated: undefined
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle NAMESPACE_REQUEST_STARTED', () => {
    const currentState = {
      activeNamespace: { name: 'all' },
      previousGraphState: undefined,
      isFetching: false,
      items: [],
      lastUpdated: undefined
    };
    const requestStartedAction = {
      type: NamespaceActionKeys.NAMESPACE_REQUEST_STARTED
    };
    const expectedState = {
      activeNamespace: { name: 'all' },
      previousGraphState: undefined,
      isFetching: true,
      items: [],
      lastUpdated: undefined
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle NAMESPACE_FAILED', () => {
    const currentState = {
      activeNamespace: { name: 'all' },
      previousGraphState: undefined,
      isFetching: true,
      items: []
    };
    const requestStartedAction = {
      type: NamespaceActionKeys.NAMESPACE_FAILED
    };
    const expectedState = {
      activeNamespace: { name: 'all' },
      previousGraphState: undefined,
      isFetching: false,
      items: []
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });

  it('should handle NAMESPACE_SUCCESS', () => {
    const currentDate = new Date();
    const currentState = {
      activeNamespace: { name: 'all' },
      previousGraphState: undefined,
      isFetching: true,
      items: ['old', 'namespace'],
      lastUpdated: undefined
    };
    const requestStartedAction = {
      type: NamespaceActionKeys.NAMESPACE_SUCCESS,
      list: ['a', 'b', 'c'],
      receivedAt: currentDate
    };
    const expectedState = {
      activeNamespace: { name: 'all' },
      previousGraphState: undefined,
      isFetching: false,
      items: ['a', 'b', 'c'],
      lastUpdated: currentDate
    };
    expect(namespaceState(currentState, requestStartedAction)).toEqual(expectedState);
  });
});

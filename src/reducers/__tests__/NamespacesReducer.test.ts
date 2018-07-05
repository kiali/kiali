import Namespace from '../Namespaces';
import { NamespaceActionKeys } from '../../actions/NamespaceAction';

describe('Namespaces reducer', () => {
  it('should return the initial state', () => {
    expect(Namespace(undefined, {})).toEqual({
      isFetching: false,
      items: []
    });
  });
  it('should handle NAMESPACE_REQUEST_STARTED', () => {
    const currentState = {
      isFetching: false,
      items: []
    };
    const requestStartedAction = {
      type: NamespaceActionKeys.NAMESPACE_REQUEST_STARTED
    };
    const expectedState = {
      isFetching: true,
      items: []
    };
    expect(Namespace(currentState, requestStartedAction)).toEqual(expectedState);
  });
  it('should handle NAMESPACE_FAILED', () => {
    const currentState = {
      isFetching: true,
      items: []
    };
    const requestStartedAction = {
      type: NamespaceActionKeys.NAMESPACE_FAILED
    };
    const expectedState = {
      isFetching: false,
      items: []
    };
    expect(Namespace(currentState, requestStartedAction)).toEqual(expectedState);
  });
  it('should handle NAMESPACE_SUCCESS', () => {
    const currentDate = new Date();
    const currentState = {
      isFetching: true,
      items: ['old', 'namespace']
    };
    const requestStartedAction = {
      type: NamespaceActionKeys.NAMESPACE_SUCCESS,
      list: ['a', 'b', 'c'],
      receivedAt: currentDate
    };
    const expectedState = {
      isFetching: false,
      items: ['a', 'b', 'c'],
      lastUpdated: currentDate
    };
    expect(Namespace(currentState, requestStartedAction)).toEqual(expectedState);
  });
});

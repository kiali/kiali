import { NamespaceActions, NamespaceActionKeys } from '../NamespaceAction';

import thunk from 'redux-thunk';
import configureMockStore from 'redux-mock-store';
import axios from 'axios';
import axiosMockAdapter from 'axios-mock-adapter';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('NamespaceActions', () => {
  const RealDate = Date;

  const mockDate = date => {
    global.Date = jest.fn(() => date) as any;
    return date;
  };

  afterEach(() => {
    global.Date = RealDate;
  });

  it('should start request', () => {
    const expectedAction = {
      type: NamespaceActionKeys.NAMESPACE_REQUEST_STARTED
    };
    expect(NamespaceActions.requestStarted()).toEqual(expectedAction);
  });
  it('request is success', () => {
    const currentDate = new Date();
    const expectedAction = {
      type: NamespaceActionKeys.NAMESPACE_SUCCESS,
      list: ['a', 'b'],
      receivedAt: currentDate
    };
    expect(NamespaceActions.receiveList(['a', 'b'], currentDate)).toEqual(expectedAction);
  });
  it('request failed', () => {
    const expectedAction = {
      type: NamespaceActionKeys.NAMESPACE_FAILED
    };
    expect(NamespaceActions.requestFailed()).toEqual(expectedAction);
  });
  it('should success if api request success', () => {
    const currentDate = new Date();
    mockDate(currentDate);
    const expectedActions = [
      {
        type: NamespaceActionKeys.NAMESPACE_REQUEST_STARTED
      },
      {
        type: NamespaceActionKeys.NAMESPACE_SUCCESS,
        list: ['a', 'b', 'c'],
        receivedAt: currentDate
      }
    ];
    const axiosMock = new axiosMockAdapter(axios);
    axiosMock.onGet('/api/namespaces').reply(200, ['a', 'b', 'c']);

    const store = mockStore({});
    return store.dispatch(NamespaceActions.asyncFetchNamespaces('dummy-token')).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });
  it('should fail if api request fails', () => {
    const expectedActions = [
      {
        type: NamespaceActionKeys.NAMESPACE_REQUEST_STARTED
      },
      {
        type: NamespaceActionKeys.NAMESPACE_FAILED
      }
    ];
    const axiosMock = new axiosMockAdapter(axios);
    axiosMock.onGet('/api/namespaces').reply(404);

    const store = mockStore({});
    return store.dispatch(NamespaceActions.asyncFetchNamespaces('dummy-token')).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });
  it("it won't fetch a namespace if one is loading", () => {
    const expectedActions = [];
    const store = mockStore({
      authentication: { token: { token: 'dummy-token' } },
      namespaces: {
        isFetching: true
      }
    });
    return store.dispatch(NamespaceActions.fetchNamespacesIfNeeded()).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });
});

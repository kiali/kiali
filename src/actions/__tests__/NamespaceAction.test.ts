import axios from 'axios';
import axiosMockAdapter from 'axios-mock-adapter';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { NamespaceActions, NamespaceThunkActions } from '../NamespaceAction';

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

  it('should set active namespace', () => {
    expect(NamespaceActions.setActiveNamespace({ name: 'istio' }).payload).toEqual({ name: 'istio' });
  });

  it('request is success', () => {
    const currentDate = new Date();
    const expectedAction = {
      list: ['a', 'b'],
      receivedAt: currentDate
    };
    expect(NamespaceActions.receiveList(['a', 'b'], currentDate).payload).toEqual(expectedAction);
  });

  it('should success if api request success', () => {
    const currentDate = new Date();
    mockDate(currentDate);
    const expectedActions = [
      NamespaceActions.requestStarted(),
      NamespaceActions.receiveList([{ name: 'all' }, 'a', 'b', 'c'], currentDate)
    ];
    const axiosMock = new axiosMockAdapter(axios);
    axiosMock.onGet('/api/namespaces').reply(200, ['a', 'b', 'c']);

    const store = mockStore({});
    return store.dispatch(NamespaceThunkActions.asyncFetchNamespaces('dummy-token')).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });

  it('should fail if api request fails', () => {
    const expectedActions = [NamespaceActions.requestStarted(), NamespaceActions.requestFailed()];
    const axiosMock = new axiosMockAdapter(axios);
    axiosMock.onGet('/api/namespaces').reply(404);

    const store = mockStore({});
    return store.dispatch(NamespaceThunkActions.asyncFetchNamespaces('dummy-token')).then(() => {
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
    return store.dispatch(NamespaceThunkActions.fetchNamespacesIfNeeded()).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });
});

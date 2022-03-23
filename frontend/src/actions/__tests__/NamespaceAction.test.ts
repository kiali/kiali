import axios from 'axios';
import axiosMockAdapter from 'axios-mock-adapter';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { NamespaceActions } from '../NamespaceAction';
import NamespaceThunkActions from '../NamespaceThunkActions';

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

  it('should set active namespaces', () => {
    expect(NamespaceActions.setActiveNamespaces([{ name: 'istio' }]).payload).toEqual([{ name: 'istio' }]);
  });

  it('should toggle active namespace', () => {
    expect(NamespaceActions.toggleActiveNamespace({ name: 'istio' }).payload).toEqual({ name: 'istio' });
  });

  it('should set filter', () => {
    expect(NamespaceActions.setFilter('istio').payload).toEqual('istio');
  });

  it('request is success', () => {
    const currentDate = new Date();
    const expectedAction = {
      list: [{ name: 'a' }, { name: 'b' }],
      receivedAt: currentDate
    };
    expect(NamespaceActions.receiveList([{ name: 'a' }, { name: 'b' }], currentDate).payload).toEqual(expectedAction);
  });

  it('should success if api request success', () => {
    const currentDate = new Date();
    mockDate(currentDate);
    const expectedActions = [
      NamespaceActions.requestStarted(),
      NamespaceActions.receiveList([{ name: 'a' }, { name: 'b' }, { name: 'c' }], currentDate)
    ];
    const axiosMock = new axiosMockAdapter(axios);
    axiosMock.onGet('/api/namespaces').reply(200, [{ name: 'a' }, { name: 'b' }, { name: 'c' }]);

    const store = mockStore({});
    return store.dispatch(NamespaceThunkActions.asyncFetchNamespaces()).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });

  it('should fail if api request fails', () => {
    const expectedActions = [NamespaceActions.requestStarted(), NamespaceActions.requestFailed()];
    const axiosMock = new axiosMockAdapter(axios);
    axiosMock.onGet('/api/namespaces').reply(404);

    const store = mockStore({});
    return store.dispatch(NamespaceThunkActions.asyncFetchNamespaces()).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });

  it("it won't fetch a namespace if one is loading", () => {
    const expectedActions = [];
    const store = mockStore({
      namespaces: {
        isFetching: true
      }
    });
    return store.dispatch(NamespaceThunkActions.fetchNamespacesIfNeeded()).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });
});

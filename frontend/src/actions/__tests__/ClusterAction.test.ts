import axios from 'axios';
import axiosMockAdapter from 'axios-mock-adapter';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { ClusterActions } from '../ClusterAction';
import ClusterThunkActions from '../ClusterThunkActions';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('ClusterActions', () => {
  const RealDate = Date;

  const mockDate = date => {
    global.Date = jest.fn(() => date) as any;
    return date;
  };

  afterEach(() => {
    global.Date = RealDate;
  });

  it('should set active clusters', () => {
    expect(ClusterActions.setActiveClusters([{ name: 'east' }]).payload).toEqual([{ name: 'east' }]);
  });

  it('should toggle active cluster', () => {
    expect(ClusterActions.toggleActiveCluster({ name: 'east' }).payload).toEqual({ name: 'east' });
  });

  it('should set filter', () => {
    expect(ClusterActions.setFilter('istio').payload).toEqual('istio');
  });

  it('request is success', () => {
    const currentDate = new Date();
    const expectedAction = {
      list: [{ name: 'a' }, { name: 'b' }],
      receivedAt: currentDate
    };
    expect(ClusterActions.receiveList([{ name: 'a' }, { name: 'b' }], currentDate).payload).toEqual(expectedAction);
  });

  it('should success if api request success', () => {
    const currentDate = new Date();
    mockDate(currentDate);
    const expectedActions = [
      ClusterActions.requestStarted(),
      ClusterActions.receiveList([{ name: 'a' }, { name: 'b' }, { name: 'c' }], currentDate)
    ];
    const axiosMock = new axiosMockAdapter(axios);
    axiosMock.onGet('/api/namespaces').reply(200, [
      { name: 'a', cluster: 'a' },
      { name: 'b', cluster: 'b' },
      { name: 'c', cluster: 'c' }
    ]);

    const store = mockStore({});
    return store.dispatch(ClusterThunkActions.asyncFetchClusters()).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });

  it('should fail if api request fails', () => {
    const expectedActions = [ClusterActions.requestStarted(), ClusterActions.requestFailed()];
    const axiosMock = new axiosMockAdapter(axios);
    axiosMock.onGet('/api/namespaces').reply(404);

    const store = mockStore({});
    return store.dispatch(ClusterThunkActions.asyncFetchClusters()).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });

  it("it won't fetch a cluster if one is loading", () => {
    const expectedActions = [];
    const store = mockStore({
      clusters: {
        isFetching: true
      }
    });
    return store.dispatch(ClusterThunkActions.fetchClustersIfNeeded()).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });
});

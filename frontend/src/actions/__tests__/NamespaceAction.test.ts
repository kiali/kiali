import axios from 'axios';
import axiosMockAdapter from 'axios-mock-adapter';
import { createStore, applyMiddleware } from 'redux';
import { NamespaceActions } from '../NamespaceAction';
import { NamespaceThunkActions } from '../NamespaceThunkActions';
import { NamespaceState } from '../../store/Store';
import { NamespaceStateReducer, INITIAL_NAMESPACE_STATE } from '../../reducers/NamespaceState';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const reduxThunkModule = require('redux-thunk');
const thunk = reduxThunkModule.thunk ?? reduxThunkModule.default;

interface TestState {
  namespaces: NamespaceState;
}

const createTestStore = (initialNamespaces = INITIAL_NAMESPACE_STATE): ReturnType<typeof createStore> =>
  createStore(
    (state: TestState = { namespaces: initialNamespaces }, action: any): TestState => ({
      namespaces: NamespaceStateReducer(state.namespaces, action)
    }),
    applyMiddleware(thunk)
  );

describe('NamespaceActions', () => {
  const RealDate = Date;

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

  it('should success if api request success', async () => {
    const axiosMock = new axiosMockAdapter(axios);
    axiosMock.onGet('/api/namespaces').reply(200, [{ name: 'a' }, { name: 'b' }, { name: 'c' }]);

    const store = createTestStore();
    await store.dispatch(NamespaceThunkActions.asyncFetchNamespaces() as any);

    const state = store.getState().namespaces;
    expect(state.isFetching).toBe(false);
    expect(state.items).toEqual([{ name: 'a' }, { name: 'b' }, { name: 'c' }]);
  });

  it('should fail if api request fails', async () => {
    const axiosMock = new axiosMockAdapter(axios);
    axiosMock.onGet('/api/namespaces').reply(404);

    const store = createTestStore();
    await store.dispatch(NamespaceThunkActions.asyncFetchNamespaces() as any);

    const state = store.getState().namespaces;
    expect(state.isFetching).toBe(false);
    expect(state.items).toEqual([]);
  });

  it("it won't fetch a namespace if one is loading", async () => {
    const store = createTestStore({ ...INITIAL_NAMESPACE_STATE, isFetching: true });
    await store.dispatch(NamespaceThunkActions.fetchNamespacesIfNeeded() as any);

    const state = store.getState().namespaces;
    expect(state.isFetching).toBe(true);
    expect(state.items).toEqual([]);
  });
});

import { serverConfig, setServerConfig } from 'config/ServerConfig';
import type { MeshClusters } from 'types/Mesh';
import type { KialiAppState } from '../../store/Store';
import type { KialiDispatch } from '../../types/Redux';
import { ClusterThunkActions } from '../ClusterThunkActions';
import { ClusterStateReducer, INITIAL_CLUSTER_STATE } from '../../reducers/ClusterState';
import { NamespaceActions } from '../NamespaceAction';
import { INITIAL_NAMESPACE_STATE } from '../../reducers/NamespaceState';

const meshClusters: MeshClusters = [
  { accessible: true, apiEndpoint: '', isKialiHome: true, kialiInstances: [], name: 'east', secretName: '' },
  { accessible: true, apiEndpoint: '', isKialiHome: false, kialiInstances: [], name: 'west', secretName: '' }
];

const toClustersMap = (clusters: MeshClusters): typeof serverConfig.clusters =>
  clusters.reduce((map, cluster) => ({ ...map, [cluster.name]: cluster }), {});

// Minimal store: the cluster and namespace slices are the only ones the thunks touch.
const createStore = (): { getState: () => KialiAppState; dispatch: KialiDispatch } => {
  let state = {
    clusters: INITIAL_CLUSTER_STATE,
    namespaces: {
      ...INITIAL_NAMESPACE_STATE,
      activeNamespaces: [{ name: 'bookinfo' }, { name: 'kube-system' }],
      namespaces: [
        { cluster: 'east', name: 'bookinfo' },
        { cluster: 'west', name: 'bookinfo' },
        { cluster: 'east', name: 'kube-system' }
      ]
    }
  } as unknown as KialiAppState;

  const getState = (): KialiAppState => state;

  const dispatch = ((action: any) => {
    if (typeof action === 'function') {
      return action(dispatch, getState);
    }

    if (action.type === NamespaceActions.setActiveNamespaces(action.payload).type) {
      state = { ...state, namespaces: { ...state.namespaces, activeNamespaces: action.payload } };
      return action;
    }

    state = { ...state, clusters: ClusterStateReducer(state.clusters, action) };
    return action;
  }) as KialiDispatch;

  return { dispatch, getState };
};

describe('ClusterThunkActions', () => {
  const originalClusters = serverConfig.clusters;

  beforeEach(() => {
    serverConfig.clusters = toClustersMap(meshClusters);
    setServerConfig(serverConfig);
  });

  afterAll(() => {
    serverConfig.clusters = originalClusters;
    setServerConfig(serverConfig);
  });

  it('drops selected namespaces that no visible cluster still contains', () => {
    const { dispatch, getState } = createStore();

    dispatch(ClusterThunkActions.setSelectedClusters(['west']));

    expect(getState().clusters.selectedClusters).toEqual(['west']);
    expect(getState().namespaces.activeNamespaces).toEqual([{ name: 'bookinfo' }]);
  });

  it('prunes on toggle as well, treating an empty selection as "all clusters"', () => {
    const { dispatch, getState } = createStore();

    dispatch(ClusterThunkActions.toggleSelectedCluster('east'));

    expect(getState().clusters.selectedClusters).toEqual(['west']);
    expect(getState().namespaces.activeNamespaces).toEqual([{ name: 'bookinfo' }]);
  });

  it('drops every selected namespace when no cluster is selected', () => {
    const { dispatch, getState } = createStore();

    dispatch(ClusterThunkActions.setSelectedClusters([]));

    expect(getState().clusters.selectedClusters).toEqual([]);
    expect(getState().namespaces.activeNamespaces).toEqual([]);
  });

  it('does not prune anything while the selection is untouched', () => {
    const { dispatch, getState } = createStore();

    dispatch(ClusterThunkActions.setSelectedClusters([]));
    dispatch(ClusterThunkActions.setSelectedClusters(['east', 'west']));

    expect(getState().clusters.selectedClusters).toBeUndefined();
    expect(getState().namespaces.activeNamespaces).toEqual([]);
  });
});

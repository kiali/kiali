import { serverConfig, setServerConfig } from 'config/ServerConfig';
import type { MeshClusters } from 'types/Mesh';
import { ClusterActions } from '../../actions/ClusterAction';
import { GlobalActions } from '../../actions/GlobalActions';
import { ClusterState } from '../../store/Store';
import { ClusterStateReducer, INITIAL_CLUSTER_STATE } from '../ClusterState';

const meshClusters: MeshClusters = [
  {
    accessible: true,
    apiEndpoint: '',
    isKialiHome: true,
    kialiInstances: [],
    name: 'east',
    secretName: ''
  },
  {
    accessible: true,
    apiEndpoint: '',
    isKialiHome: false,
    kialiInstances: [],
    name: 'west',
    secretName: ''
  }
];

const stateWith = (selectedClusters: string[] | undefined): ClusterState => ({
  ...INITIAL_CLUSTER_STATE,
  selectedClusters
});

describe('ClusterState reducer', () => {
  const originalClusters = serverConfig.clusters;

  beforeEach(() => {
    serverConfig.clusters = meshClusters.reduce((map, cluster) => ({ ...map, [cluster.name]: cluster }), {});
    setServerConfig(serverConfig);
  });

  afterEach(() => {
    serverConfig.clusters = originalClusters;
    setServerConfig(serverConfig);
  });

  it('defaults to "all clusters"', () => {
    expect(ClusterStateReducer(undefined, GlobalActions.unknown()).selectedClusters).toBeUndefined();
  });

  it('normalizes the clusters set explicitly', () => {
    const state = ClusterStateReducer(stateWith([]), ClusterActions.setSelectedClusters(['west', 'west']));

    expect(state.selectedClusters).toEqual(['west']);
  });

  it('collapses a full selection to "all clusters"', () => {
    const state = ClusterStateReducer(stateWith(['west']), ClusterActions.setSelectedClusters(['east', 'west']));

    expect(state.selectedClusters).toBeUndefined();
  });

  it('expands the implicit "all clusters" when one cluster is deselected', () => {
    const state = ClusterStateReducer(stateWith(undefined), ClusterActions.toggleSelectedCluster('west'));

    expect(state.selectedClusters).toEqual(['east']);
  });

  it('adds a cluster to an explicit selection', () => {
    const state = ClusterStateReducer(stateWith(['east']), ClusterActions.toggleSelectedCluster('west'));

    expect(state.selectedClusters).toBeUndefined();
  });

  it('leaves an empty selection when the last selected cluster is deselected', () => {
    const state = ClusterStateReducer(stateWith(['west']), ClusterActions.toggleSelectedCluster('west'));

    expect(state.selectedClusters).toEqual([]);
  });

  it('keeps the rest of the state when the selection changes', () => {
    const state = ClusterStateReducer(stateWith(undefined), ClusterActions.toggleSelectedCluster('west'));

    expect(state.activeClusters).toEqual([]);
    expect(state.filter).toEqual('');
  });
});

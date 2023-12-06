import { ClusterActions } from '../ClusterAction';
import { MeshCluster } from '../../types/Mesh';

describe('ClusterActions', () => {
  const cluster: MeshCluster = {
    name: 'east',
    isKialiHome: true,
    kialiInstances: [],
    secretName: '',
    apiEndpoint: '',
    network: '',
    accessible: true
  };

  it('should set active clusters', () => {
    expect(ClusterActions.setActiveClusters([cluster]).payload).toEqual([cluster]);
  });

  it('should toggle active cluster', () => {
    expect(ClusterActions.toggleActiveCluster(cluster).payload).toEqual(cluster);
  });

  it('should set filter', () => {
    expect(ClusterActions.setFilter('istio').payload).toEqual('istio');
  });
});

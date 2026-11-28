import { serverConfig, setServerConfig } from 'config/ServerConfig';
import type { MeshClusters } from 'types/Mesh';
import {
  allClusterNames,
  filterBySelectedClusters,
  isClusterVisible,
  normalizeSelectedClusters,
  visibleClusterNames
} from '../ClusterUtils';

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

const toClustersMap = (clusters: MeshClusters): typeof serverConfig.clusters =>
  clusters.reduce((map, cluster) => ({ ...map, [cluster.name]: cluster }), {});

describe('ClusterUtils', () => {
  const originalClusters = serverConfig.clusters;

  beforeEach(() => {
    serverConfig.clusters = toClustersMap(meshClusters);
    setServerConfig(serverConfig);
  });

  afterEach(() => {
    serverConfig.clusters = originalClusters;
    setServerConfig(serverConfig);
  });

  it('lists every cluster reported by the backend', () => {
    expect(allClusterNames()).toEqual(['east', 'west']);
  });

  describe('isClusterVisible', () => {
    it('treats an undefined selection as all clusters', () => {
      expect(isClusterVisible(undefined, 'east')).toBe(true);
      expect(isClusterVisible(undefined, 'west')).toBe(true);
    });

    it('treats an empty selection as no clusters', () => {
      expect(isClusterVisible([], 'east')).toBe(false);
      expect(isClusterVisible([], 'west')).toBe(false);
    });

    it('shows only the selected clusters', () => {
      expect(isClusterVisible(['west'], 'west')).toBe(true);
      expect(isClusterVisible(['west'], 'east')).toBe(false);
    });

    it('keeps resources without a cluster visible', () => {
      expect(isClusterVisible(['west'], undefined)).toBe(true);
    });
  });

  describe('normalizeSelectedClusters', () => {
    it('drops duplicates and unknown clusters', () => {
      expect(normalizeSelectedClusters(['west', 'west', 'unknown'])).toEqual(['west']);
    });

    it('stores a selection of every cluster as the unfiltered state', () => {
      expect(normalizeSelectedClusters(['east', 'west'])).toBeUndefined();
    });

    it('keeps an empty selection as "no clusters"', () => {
      expect(normalizeSelectedClusters([])).toEqual([]);
    });
  });

  describe('visibleClusterNames', () => {
    it('returns every cluster when nothing is selected', () => {
      expect(visibleClusterNames(undefined)).toEqual(['east', 'west']);
    });

    it('returns no cluster when the selection is empty', () => {
      expect(visibleClusterNames([])).toEqual([]);
    });

    it('returns the selection in backend order', () => {
      expect(visibleClusterNames(['west'])).toEqual(['west']);
    });

    it('ignores clusters that no longer exist', () => {
      expect(visibleClusterNames(['gone'])).toEqual([]);
    });
  });

  describe('filterBySelectedClusters', () => {
    const items = [{ cluster: 'east', name: 'a' }, { cluster: 'west', name: 'b' }, { name: 'c' }];

    it('returns the list untouched when nothing is selected', () => {
      expect(filterBySelectedClusters(items, undefined)).toBe(items);
    });

    it('drops every cluster scoped item when the selection is empty', () => {
      expect(filterBySelectedClusters(items, [])).toEqual([{ name: 'c' }]);
    });

    it('keeps the items of the selected clusters and the unscoped items', () => {
      expect(filterBySelectedClusters(items, ['west'])).toEqual([{ cluster: 'west', name: 'b' }, { name: 'c' }]);
    });
  });
});

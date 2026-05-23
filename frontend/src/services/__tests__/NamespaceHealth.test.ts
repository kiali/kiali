import { fetchClusterNamespacesHealth } from '../NamespaceHealth';
import * as API from 'services/Api';

jest.mock('services/Api', () => ({
  getClustersHealth: jest.fn()
}));

describe('NamespaceHealth service', () => {
  const emptyBucket = {
    inError: [],
    inNotReady: [],
    inSuccess: [],
    inWarning: [],
    notAvailable: []
  };

  it('chunks namespace lists and merges results', async () => {
    const namespaces = Array.from({ length: 205 }, (_, i) => `ns${i}`);

    (API.getClustersHealth as jest.Mock).mockImplementation(async (nsStr: string) => {
      const keys = nsStr.split(',');
      const m = new Map<string, any>();
      m.set(keys[0], {
        appHealth: {},
        serviceHealth: {},
        workloadHealth: {},
        statusApp: emptyBucket,
        statusService: emptyBucket,
        statusWorkload: emptyBucket,
        worstStatus: 'NA'
      });
      return m;
    });

    const result = await fetchClusterNamespacesHealth(namespaces, 'c1', 60);

    expect(API.getClustersHealth).toHaveBeenCalledTimes(3);
    expect(result.size).toBe(3);
    expect(Array.from(result.keys())).toEqual(['ns0', 'ns100', 'ns200']);
    expect(result.get('ns0')?.worstStatus).toBe('NA');
  });

  it('adds chunk context when a namespace health request fails', async () => {
    const namespaces = Array.from({ length: 101 }, (_, i) => `ns${i}`);

    (API.getClustersHealth as jest.Mock).mockImplementation(async (nsStr: string) => {
      if (nsStr === 'ns100') {
        throw new Error('request timed out');
      }

      return new Map<string, any>();
    });

    await expect(fetchClusterNamespacesHealth(namespaces, 'east', 60)).rejects.toThrow(
      'Failed to fetch namespace health chunk 2/2 for cluster east (1 namespaces: ns100): request timed out'
    );
  });

  it('reports chunk failures without rejecting when an error callback is provided', async () => {
    const namespaces = Array.from({ length: 101 }, (_, i) => `ns${i}`);
    const onChunkError = jest.fn();

    (API.getClustersHealth as jest.Mock).mockImplementation(async (nsStr: string) => {
      if (nsStr === 'ns100') {
        throw new Error('request timed out');
      }

      const m = new Map<string, any>();
      m.set('ns0', {
        appHealth: {},
        serviceHealth: {},
        workloadHealth: {},
        statusApp: emptyBucket,
        statusService: emptyBucket,
        statusWorkload: emptyBucket,
        worstStatus: 'NA'
      });
      return m;
    });

    const result = await fetchClusterNamespacesHealth(namespaces, 'east', 60, onChunkError);

    expect(onChunkError).toHaveBeenCalledWith(
      'Failed to fetch namespace health chunk 2/2 for cluster east (1 namespaces: ns100): request timed out'
    );
    expect(Array.from(result.keys())).toEqual(['ns0']);
  });
});

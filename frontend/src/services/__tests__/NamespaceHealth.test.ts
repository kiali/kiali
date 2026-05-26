import { fetchClusterNamespacesHealth } from '../NamespaceHealth';
import * as API from 'services/Api';
import { addDanger } from 'utils/AlertUtils';

jest.mock('services/Api', () => ({
  getClustersHealth: jest.fn()
}));

jest.mock('utils/AlertUtils', () => ({
  addDanger: jest.fn()
}));

describe('NamespaceHealth service', () => {
  const emptyBucket = {
    inError: [],
    inNotReady: [],
    inSuccess: [],
    inWarning: [],
    notAvailable: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

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

    const result = await fetchClusterNamespacesHealth(namespaces, 'east', 60);

    expect(addDanger).toHaveBeenCalledWith(
      'Failed to fetch namespace health chunk 2/2 for cluster east (1 namespaces: ns100): request timed out'
    );
    expect(result.size).toBe(0);
  });

  it('keeps single request failures scoped to the namespace instead of chunk context', async () => {
    (API.getClustersHealth as jest.Mock).mockRejectedValueOnce(new Error('request timed out'));

    const result = await fetchClusterNamespacesHealth(['bookinfo'], 'east', 60);

    expect(addDanger).toHaveBeenCalledWith(
      'Failed to fetch namespace health for cluster east (namespace bookinfo): request timed out'
    );
    expect(result.size).toBe(0);
  });

  it('reports chunk failures without rejecting', async () => {
    const namespaces = Array.from({ length: 101 }, (_, i) => `ns${i}`);

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

    const result = await fetchClusterNamespacesHealth(namespaces, 'east', 60);

    expect(addDanger).toHaveBeenCalledWith(
      'Failed to fetch namespace health chunk 2/2 for cluster east (1 namespaces: ns100): request timed out'
    );
    expect(Array.from(result.keys())).toEqual(['ns0']);
  });

  it('reports each failed chunk with a unique message', async () => {
    const namespaces = Array.from({ length: 201 }, (_, i) => `ns${i}`);

    (API.getClustersHealth as jest.Mock).mockImplementation(async (nsStr: string) => {
      if (nsStr.startsWith('ns0') || nsStr === 'ns200') {
        throw new Error('request timed out');
      }

      return new Map<string, any>();
    });

    await fetchClusterNamespacesHealth(namespaces, 'east', 60);

    expect(addDanger).toHaveBeenCalledTimes(2);
    expect(addDanger).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('Failed to fetch namespace health chunk 1/3 for cluster east')
    );
    expect(addDanger).toHaveBeenNthCalledWith(
      2,
      'Failed to fetch namespace health chunk 3/3 for cluster east (1 namespaces: ns200): request timed out'
    );
  });
});

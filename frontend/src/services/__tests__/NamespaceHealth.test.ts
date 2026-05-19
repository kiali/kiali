import { fetchClusterNamespacesHealth } from '../NamespaceHealth';
import * as API from 'services/Api';
import type { Mock } from '@rstest/core';

rstest.mock('services/Api', () => ({
  getClustersHealth: rstest.fn()
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

    (API.getClustersHealth as Mock).mockImplementation(async (nsStr: string) => {
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
});

import { fetchClusterNamespacesHealth } from '../NamespaceHealth';
import * as API from 'services/Api';

jest.mock('services/Api', () => ({
  getClustersHealth: jest.fn()
}));

describe('NamespaceHealth service', () => {
  it('chunks namespace lists and merges results', async () => {
    const namespaces = Array.from({ length: 205 }, (_, i) => `ns${i}`);

    (API.getClustersHealth as jest.Mock).mockImplementation(async (nsStr: string) => {
      const keys = nsStr.split(',');
      const m = new Map<string, any>();
      m.set(keys[0], { appHealth: {}, serviceHealth: {}, workloadHealth: {} });
      return m;
    });

    const result = await fetchClusterNamespacesHealth(namespaces, 60, 'c1');

    expect(API.getClustersHealth).toHaveBeenCalledTimes(3);
    expect(result.size).toBe(3);
    expect(Array.from(result.keys())).toEqual(['ns0', 'ns100', 'ns200']);
  });
});

import { test } from '../../fixtures/kialiFixtures';
import { smokeOnly } from '../../utils/suite-tags';

test.describe('Mesh page smoke', () => {
  test('Local-kiali: see kiali node in local mode', smokeOnly, async ({ meshPage, baseURL }) => {
    const host = new URL(baseURL ?? 'http://localhost:3001').hostname;
    test.skip(host !== 'localhost' && host !== '127.0.0.1', 'Requires local kiali run (not in-cluster)');

    await meshPage.open();
    await meshPage.expectKialiConnectedToIstiod(1);
  });
});

import { test } from '../../fixtures/kialiFixtures';
import { smokeOnly } from '../../utils/suite-tags';

test.describe('Mesh page smoke', () => {
  test('Local-kiali: see kiali node in local mode', smokeOnly, async ({ meshPage }) => {
    await meshPage.open();
    await meshPage.expectKialiConnectedToIstiod(1);
  });
});

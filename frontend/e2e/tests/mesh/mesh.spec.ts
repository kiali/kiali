import { test } from '../../fixtures/kialiFixtures';

test.describe('Mesh page smoke', () => {
  test('Local-kiali: see kiali node in local mode @smoke', async ({ meshPage }) => {
    await meshPage.open();
    await meshPage.expectKialiConnectedToIstiod(1);
  });
});

import { test } from '../../fixtures/kialiFixtures';
import { externalKialiOnly } from '../../utils/suite-tags';

test.describe('External Kiali mesh', () => {
  test.beforeEach(async ({ meshPage }) => {
    await meshPage.open();
  });

  test('see one dataplane and one controlplane for mesh cluster', externalKialiOnly, async ({ meshPage }) => {
    await meshPage.expectInfraNodeCount('dataplane', 'mesh', 1);
    await meshPage.expectInfraNodeCount('istiod', 'mesh', 1);
    await meshPage.expectInfraConnectedTo('istiod', 'dataplane', 1);
  });

  test('see only kiali for mgmt cluster', externalKialiOnly, async ({ meshPage }) => {
    await meshPage.expectInfraNodeCount('kiali', 'mgmt', 1);
    await meshPage.expectInfraNodeCount('dataplane', 'mgmt', 0);
    await meshPage.expectInfraNodeCount('istiod', 'mgmt', 0);
    await meshPage.expectInfraConnectedTo('kiali', 'istiod', 1);
  });
});

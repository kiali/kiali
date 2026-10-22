import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { isOssmc } from '../../utils/kialiConfig';
import { selectNamespace } from '../../utils/namespace';
import { core2, coreCachingOnly } from '../../utils/suite-tags';

test.describe('Istio Config editor', () => {
  test.beforeEach(async ({ istioConfigPage, page }) => {
    ensureDemoApp('bookinfo');
    await istioConfigPage.open();
    await selectNamespace(page, 'bookinfo');
  });

  test('Filter Istio Config editor objects by Valid configuration', coreCachingOnly, async ({ istioConfigPage }) => {
    await istioConfigPage.filterBy('Config', 'Valid');
    await istioConfigPage.expectRowsVisible('bookinfo-gateway', 'bookinfo');
    await istioConfigPage.openConfigByName('bookinfo');
    await istioConfigPage.expectEditorVisible();
    await istioConfigPage.expectNoClusterBadge();
  });

  test('Unsaved YAML edits show reload confirmation', core2, async ({ istioConfigPage }) => {
    test.skip(isOssmc(), 'Monaco editor unsaved-changes modal is not reachable in OSSMC kiosk mode');

    await istioConfigPage.openConfigByName('bookinfo');
    await istioConfigPage.expectEditorVisible();
    await istioConfigPage.editYaml();
    await istioConfigPage.clickReload();
    await istioConfigPage.expectUnsavedModal('Reload');
    await istioConfigPage.cancelUnsavedModal();
    await istioConfigPage.expectNoUnsavedModal();
    await istioConfigPage.expectEditorVisible();
  });

  test('Unsaved YAML edits show leave confirmation on Cancel', core2, async ({ istioConfigPage }) => {
    test.skip(isOssmc(), 'Monaco editor unsaved-changes modal is not reachable in OSSMC kiosk mode');

    await istioConfigPage.openConfigByName('bookinfo');
    await istioConfigPage.expectEditorVisible();
    await istioConfigPage.editYaml();
    await istioConfigPage.clickCancel();
    await istioConfigPage.expectUnsavedModal('Leave');
    await istioConfigPage.cancelUnsavedModal();
    await istioConfigPage.expectNoUnsavedModal();
    await istioConfigPage.expectEditorVisible();
  });
});

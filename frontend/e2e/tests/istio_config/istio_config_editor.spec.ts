import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { selectNamespace } from '../../utils/namespace';
import { core2 } from '../../utils/suite-tags';

const isOssmc = (): boolean => process.env.PLAYWRIGHT_OSSMC === 'true';

test.describe('Istio Config editor', () => {
  test.beforeEach(async ({ istioConfigPage, page }) => {
    ensureDemoApp('bookinfo');
    await istioConfigPage.open();
    await selectNamespace(page, 'bookinfo');
  });

  test('Unsaved YAML edits show reload confirmation', core2, async ({ istioConfigPage }) => {
    test.skip(isOssmc(), 'Monaco editor unsaved-changes modal is skipped in OSSMC (Cypress @skip-ossmc)');

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
    test.skip(isOssmc(), 'Monaco editor unsaved-changes modal is skipped in OSSMC (Cypress @skip-ossmc)');

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

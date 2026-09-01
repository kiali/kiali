import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { acquireBookinfoRoutingLock } from '../../utils/bookinfoRoutingLock';
import {
  deleteK8sGateway,
  deleteK8sReferenceGrant,
  ensureBookinfoTlsCertSecret
} from '../../utils/istioConfigResources';
import { isGatewayApiEnabled } from '../../utils/kialiConfig';
import { selectNamespace } from '../../utils/namespace';
import { core2 } from '../../utils/suite-tags';

const gatewayName = 'k8sapigateway';
const namespace = 'bookinfo';

test.describe('Istio Config wizard: K8s Gateway API', () => {
  test.describe.configure({ mode: 'serial' });

  let releaseGatewayLock: (() => void) | undefined;

  test.beforeAll(async () => {
    releaseGatewayLock = await acquireBookinfoRoutingLock();
  });

  test.afterAll(() => {
    releaseGatewayLock?.();
    releaseGatewayLock = undefined;
  });

  test.beforeEach(async ({ istioConfigPage, request, page }) => {
    ensureDemoApp('bookinfo');
    test.skip(!(await isGatewayApiEnabled(request)), 'Gateway API is not enabled');
    await istioConfigPage.open();
    await selectNamespace(page, namespace);
  });

  test('Create a K8s Gateway scenario', core2, async ({ istioConfigPage, istioConfigWizardPage }) => {
    deleteK8sGateway(gatewayName, namespace);
    await istioConfigPage.clickCreateIstioConfigAction('K8sGateway');
    await istioConfigWizardPage.expectConfigWizard('Create K8sGateway');
    await istioConfigWizardPage.addListener();
    await istioConfigWizardPage.typesInInput('name', gatewayName);
    await istioConfigWizardPage.typesInInput('addName_0', 'listener');
    await istioConfigWizardPage.checkHostnameValidation('addHostname_0');
    await istioConfigWizardPage.typesInInput('addHostname_0', 'website.com');
    await istioConfigWizardPage.typesInInput('addPort_0', '8080');
    await istioConfigWizardPage.previewConfiguration();
    await istioConfigWizardPage.createIstioConfig();
    await istioConfigPage.expectObjectListed('K8sGateway', gatewayName, namespace);
  });

  test('Create a K8s Gateway HTTPS scenario', core2, async ({ istioConfigPage, istioConfigWizardPage }) => {
    ensureBookinfoTlsCertSecret();
    deleteK8sGateway(gatewayName, namespace);
    await istioConfigPage.clickCreateIstioConfigAction('K8sGateway');
    await istioConfigWizardPage.expectConfigWizard('Create K8sGateway');
    await istioConfigWizardPage.addListener();
    await istioConfigWizardPage.typesInInput('name', gatewayName);
    await istioConfigWizardPage.typesInInput('addName_0', 'listener');
    await istioConfigWizardPage.checkHostnameValidation('addHostname_0');
    await istioConfigWizardPage.typesInInput('addHostname_0', 'website.com');
    await istioConfigWizardPage.typesInInput('addPort_0', '443');
    await istioConfigWizardPage.chooseModeFromSelect('HTTPS', 'addPortProtocol_0');
    await istioConfigWizardPage.expectPreviewButtonDisabled();
    await istioConfigWizardPage.typesInInput('tlsCert_0', 'cert');
    await istioConfigWizardPage.previewConfiguration();
    await istioConfigWizardPage.createIstioConfig();
    await istioConfigPage.expectObjectListed('K8sGateway', gatewayName, namespace);
  });

  test('Create a K8s Reference Grant scenario', core2, async ({ istioConfigPage, istioConfigWizardPage }) => {
    const refGrantName = 'k8srefgrant';
    deleteK8sReferenceGrant(refGrantName, namespace);
    await istioConfigPage.clickCreateIstioConfigAction('K8sReferenceGrant');
    await istioConfigWizardPage.expectConfigWizard('Create K8sReferenceGrant');
    await istioConfigWizardPage.typesInInput('name', refGrantName);
    await istioConfigWizardPage.chooseModeFromSelect('Gateway', 'ReferenceGrantFromKind');
    await istioConfigWizardPage.chooseModeFromSelect('Secret', 'ReferenceGrantToKind');
    await istioConfigWizardPage.chooseModeFromSelect('istio-system', 'ReferenceGrantFromNamespace');
    await istioConfigWizardPage.previewConfiguration();
    await istioConfigWizardPage.createIstioConfig();
    await istioConfigPage.expectObjectListed('K8sReferenceGrant', refGrantName, namespace);
  });
});

import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { useBookinfoRoutingLockPerTest } from '../../utils/bookinfoRoutingLock';
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
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  useBookinfoRoutingLockPerTest();

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

  test(
    'Create colliding K8s Gateways and drop the reference after delete',
    core2,
    async ({ istioConfigPage, istioConfigWizardPage, page }) => {
      const first = 'gatewayapi-1';
      const second = 'gatewayapi-2';
      const collidingHost = 'bookinfo-istio-system.apps.ocp4-kqe1.maistra.upshift.redhat.com';

      const createCollidingGateway = async (name: string): Promise<void> => {
        await istioConfigPage.open();
        await selectNamespace(page, namespace);
        await istioConfigPage.clickCreateIstioConfigAction('K8sGateway');
        await istioConfigWizardPage.expectConfigWizard('Create K8sGateway');
        await istioConfigWizardPage.addListener();
        await istioConfigWizardPage.typesInInput('name', name);
        await istioConfigWizardPage.typesInInput('addName_0', 'default');
        await istioConfigWizardPage.typesInInput('addHostname_0', collidingHost);
        await istioConfigWizardPage.typesInInput('addPort_0', '80');
        await istioConfigWizardPage.addHostname();
        await istioConfigWizardPage.chooseModeFromSelect('Hostname', 'addType_0');
        await istioConfigWizardPage.typesInInput('addValue_0', 'google.com');
        await istioConfigWizardPage.previewConfiguration();
        await istioConfigWizardPage.createIstioConfig();
      };

      try {
        deleteK8sGateway(first, namespace);
        deleteK8sGateway(second, namespace);
        await createCollidingGateway(first);
        await createCollidingGateway(second);

        await istioConfigPage.expectObjectListed('K8sGateway', first, namespace);
        await istioConfigPage.expectObjectListed('K8sGateway', second, namespace);
        await istioConfigPage.expectValidationStatus(namespace, 'K8sGateway', first, 'warning');
        await istioConfigPage.expectValidationStatus(namespace, 'K8sGateway', second, 'warning');

        await istioConfigPage.openConfigByRow(namespace, 'K8sGateway', first);
        await istioConfigPage.expectK8sGatewayReferenced(namespace, second, true);

        await istioConfigPage.open();
        await selectNamespace(page, namespace);
        await istioConfigPage.openConfigByRow(namespace, 'K8sGateway', second);
        await istioConfigPage.deleteCurrentConfig();

        await istioConfigPage.open();
        await selectNamespace(page, namespace);
        await istioConfigPage.expectObjectNotListed('K8sGateway', second, namespace);
        await istioConfigPage.expectValidationStatus(namespace, 'K8sGateway', first, 'success');

        await istioConfigPage.openConfigByRow(namespace, 'K8sGateway', first);
        await istioConfigPage.expectK8sGatewayReferenced(namespace, second, false);
      } finally {
        deleteK8sGateway(first, namespace);
        deleteK8sGateway(second, namespace);
      }
    }
  );
});

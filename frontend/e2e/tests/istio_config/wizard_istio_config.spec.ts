import { expect } from '@playwright/test';

import { test } from '../../fixtures/kialiFixtures';
import { useBookinfoRoutingLockPerTest } from '../../utils/bookinfoRoutingLock';
import { ensureDemoApp } from '../../utils/demoApps';
import { deleteIstioGateway, deleteServiceEntry, deleteSidecar } from '../../utils/istioConfigResources';
import { selectNamespace } from '../../utils/namespace';
import { coreCachingOnly } from '../../utils/suite-tags';

const namespace = 'bookinfo';

test.describe.serial('Istio Config wizard core-caching', () => {
  test.describe.configure({ timeout: 180_000 });

  useBookinfoRoutingLockPerTest();

  test.beforeEach(async ({ istioConfigPage, page }) => {
    ensureDemoApp('bookinfo');
    await istioConfigPage.open();
    await selectNamespace(page, namespace);
  });

  test(
    'Dropdown for cluster selection should not be visible in single cluster setup',
    coreCachingOnly,
    async ({ istioConfigPage, istioConfigWizardPage }) => {
      await istioConfigPage.clickCreateIstioConfigAction('Gateway');
      await istioConfigWizardPage.expectConfigWizard('Create Gateway');
      await istioConfigWizardPage.expectNoClusterDropdown();
    }
  );

  test(
    'Create an Sidecar with labels and annotations',
    coreCachingOnly,
    async ({ istioConfigPage, istioConfigWizardPage }) => {
      deleteSidecar('mysidecarwithlabels', namespace);
      await istioConfigPage.clickCreateIstioConfigAction('Sidecar');
      await istioConfigWizardPage.expectConfigWizard('Create Sidecar');
      await istioConfigWizardPage.typesInInput('name', 'mysidecarwithlabels');
      await istioConfigWizardPage.editLabels('app', 'details');
      await istioConfigWizardPage.editAnnotations('key1', 'value1');
      await istioConfigWizardPage.previewConfiguration();
      await istioConfigWizardPage.expectPreviewContains('app: details');
      await istioConfigWizardPage.expectPreviewContains('key1: value1');
      await istioConfigWizardPage.createIstioConfig();
      await istioConfigPage.expectObjectListed('Sidecar', 'mysidecarwithlabels', namespace);
      deleteSidecar('mysidecarwithlabels', namespace);
    }
  );

  test('Try to create a Gateway with no name', coreCachingOnly, async ({ istioConfigPage, istioConfigWizardPage }) => {
    await istioConfigPage.clickCreateIstioConfigAction('Gateway');
    await istioConfigWizardPage.expectConfigWizard('Create Gateway');
    await istioConfigWizardPage.expectInputEmpty('name');
    await istioConfigWizardPage.expectInputWarning('name', true);
    await istioConfigWizardPage.expectPreviewButtonDisabled();
  });

  test(
    'Try to create a Gateway with invalid name',
    coreCachingOnly,
    async ({ istioConfigPage, istioConfigWizardPage }) => {
      await istioConfigPage.clickCreateIstioConfigAction('Gateway');
      await istioConfigWizardPage.expectConfigWizard('Create Gateway');
      await istioConfigWizardPage.typesInInput('name', '!@#$%^*()_+');
      await istioConfigWizardPage.expectInputWarning('name', true);
      await istioConfigWizardPage.expectPreviewButtonDisabled();
    }
  );

  test(
    'Create a Gateway scenario and check that Gateway with the same name cannot be created',
    coreCachingOnly,
    async ({ istioConfigPage, istioConfigWizardPage }) => {
      deleteIstioGateway('mygateway', namespace);
      await istioConfigPage.clickCreateIstioConfigAction('Gateway');
      await istioConfigWizardPage.expectConfigWizard('Create Gateway');
      await istioConfigWizardPage.typesInInput('name', 'mygateway');
      await istioConfigWizardPage.addServerToServerList();
      await istioConfigWizardPage.expectPreviewButtonDisabled();
      await istioConfigWizardPage.typesInInput('hosts_0', 'website.com');
      await istioConfigWizardPage.typesInInput('addPortNumber_0', '8080');
      await istioConfigWizardPage.typesInInput('addPortName_0', 'foobar');
      await istioConfigWizardPage.previewConfiguration();
      await istioConfigWizardPage.createIstioConfig();
      await istioConfigPage.expectObjectListed('Gateway', 'mygateway', namespace);
      await istioConfigWizardPage.closeSuccessNotification();
      await istioConfigPage.clickCreateIstioConfigAction('Gateway');
      await istioConfigWizardPage.expectConfigWizard('Create Gateway');
      await istioConfigWizardPage.typesInInput('name', 'mygateway');
      await istioConfigWizardPage.addServerToServerList();
      await istioConfigWizardPage.typesInInput('hosts_0', 'website.com');
      await istioConfigWizardPage.typesInInput('addPortNumber_0', '8080');
      await istioConfigWizardPage.typesInInput('addPortName_0', 'foobar');
      await istioConfigWizardPage.previewConfiguration();
      await istioConfigWizardPage.clickCreate();
      await istioConfigWizardPage.expectErrorMessage(
        'Could not create Istio networking.istio.io/v1, Kind=Gateway objects'
      );
    }
  );

  test(
    'Try to create a Gateway with negative port number',
    coreCachingOnly,
    async ({ istioConfigPage, istioConfigWizardPage }) => {
      await istioConfigPage.clickCreateIstioConfigAction('Gateway');
      await istioConfigWizardPage.expectConfigWizard('Create Gateway');
      await istioConfigWizardPage.typesInInput('name', 'mygateway2');
      await istioConfigWizardPage.addServerToServerList();
      await istioConfigWizardPage.typesInInput('hosts_0', 'website.com');
      await istioConfigWizardPage.typesInInput('addPortNumber_0', '-8080');
      await istioConfigWizardPage.typesInInput('addPortName_0', 'foobar');
      await istioConfigWizardPage.expectPreviewButtonDisabled();
      await istioConfigWizardPage.expectInputWarning('addPortNumber_0', true);
    }
  );

  test(
    'Try to create a Gateway with invalid port number',
    coreCachingOnly,
    async ({ istioConfigPage, istioConfigWizardPage }) => {
      await istioConfigPage.clickCreateIstioConfigAction('Gateway');
      await istioConfigWizardPage.expectConfigWizard('Create Gateway');
      await istioConfigWizardPage.typesInInput('name', 'mygateway2');
      await istioConfigWizardPage.addServerToServerList();
      await istioConfigWizardPage.typesInInput('hosts_0', 'website.com');
      await istioConfigWizardPage.typesInInput('addPortNumber_0', '65536');
      await istioConfigWizardPage.typesInInput('addPortName_0', 'foobar');
      await istioConfigWizardPage.expectPreviewButtonDisabled();
      await istioConfigWizardPage.expectInputWarning('addPortNumber_0', true);
    }
  );

  test(
    'Try to insert letters in the port field',
    coreCachingOnly,
    async ({ istioConfigPage, istioConfigWizardPage }) => {
      await istioConfigPage.clickCreateIstioConfigAction('Gateway');
      await istioConfigWizardPage.expectConfigWizard('Create Gateway');
      await istioConfigWizardPage.typesInInput('name', 'mygateway2');
      await istioConfigWizardPage.addServerToServerList();
      await istioConfigWizardPage.typesInInput('hosts_0', 'website.com');
      await istioConfigWizardPage.typesInInput('addPortNumber_0', 'lorem ipsum');
      await istioConfigWizardPage.typesInInput('addPortName_0', 'foobar');
      await istioConfigWizardPage.expectPreviewButtonDisabled();
      await istioConfigWizardPage.expectInputWarning('addPortNumber_0', true);
    }
  );

  test(
    'Try to create a Gateway without filling the inputs related to TLS',
    coreCachingOnly,
    async ({ istioConfigPage, istioConfigWizardPage }) => {
      await istioConfigPage.clickCreateIstioConfigAction('Gateway');
      await istioConfigWizardPage.expectConfigWizard('Create Gateway');
      await istioConfigWizardPage.typesInInput('name', 'mygatewaywithtls');
      await istioConfigWizardPage.addServerToServerList();
      await istioConfigWizardPage.typesInInput('hosts_0', 'website.com');
      await istioConfigWizardPage.typesInInput('addPortNumber_0', '8080');
      await istioConfigWizardPage.typesInInput('addPortName_0', 'foobar');
      await istioConfigWizardPage.chooseModeFromSelect('TLS', 'addPortProtocol_0');
      await istioConfigWizardPage.chooseModeFromSelect('SIMPLE', 'addTlsMode');
      await istioConfigWizardPage.expectInputEmpty('server-certificate');
      await istioConfigWizardPage.expectInputWarning('server-certificate', true);
      await istioConfigWizardPage.expectInputEmpty('private-key');
      await istioConfigWizardPage.expectInputWarning('private-key', true);
      await istioConfigWizardPage.expectPreviewButtonDisabled();
    }
  );

  test('Create a Gateway with TLS', coreCachingOnly, async ({ istioConfigPage, istioConfigWizardPage }) => {
    deleteIstioGateway('mygatewaywithtls', namespace);
    await istioConfigPage.clickCreateIstioConfigAction('Gateway');
    await istioConfigWizardPage.expectConfigWizard('Create Gateway');
    await istioConfigWizardPage.typesInInput('name', 'mygatewaywithtls');
    await istioConfigWizardPage.addServerToServerList();
    await istioConfigWizardPage.typesInInput('hosts_0', 'website.com');
    await istioConfigWizardPage.typesInInput('addPortNumber_0', '8080');
    await istioConfigWizardPage.typesInInput('addPortName_0', 'foobar');
    await istioConfigWizardPage.chooseModeFromSelect('TLS', 'addPortProtocol_0');
    await istioConfigWizardPage.chooseModeFromSelect('SIMPLE', 'addTlsMode');
    await istioConfigWizardPage.typesInInput('server-certificate', 'foo');
    await istioConfigWizardPage.typesInInput('private-key', 'bar');
    await istioConfigWizardPage.previewConfiguration();
    await istioConfigWizardPage.createIstioConfig();
    await istioConfigPage.expectObjectListed('Gateway', 'mygatewaywithtls', namespace);
  });

  test(
    'Try to create a ServiceEntry with empty fields',
    coreCachingOnly,
    async ({ istioConfigPage, istioConfigWizardPage }) => {
      await istioConfigPage.clickCreateIstioConfigAction('ServiceEntry');
      await istioConfigWizardPage.expectConfigWizard('Create ServiceEntry');
      await istioConfigWizardPage.expectInputEmpty('name');
      await istioConfigWizardPage.expectInputWarning('name', true);
      await istioConfigWizardPage.expectInputEmpty('hosts');
      await istioConfigWizardPage.expectInputWarning('hosts', true);
      await istioConfigWizardPage.expectMessage('ServiceEntry has no Ports defined');
      await istioConfigWizardPage.expectPreviewButtonDisabled();
    }
  );

  test(
    'Try to create a ServiceEntry with invalid name and host specified',
    coreCachingOnly,
    async ({ istioConfigPage, istioConfigWizardPage }) => {
      await istioConfigPage.clickCreateIstioConfigAction('ServiceEntry');
      await istioConfigWizardPage.expectConfigWizard('Create ServiceEntry');
      await istioConfigWizardPage.typesInInput('name', '%%%%$#&*&');
      await istioConfigWizardPage.typesInInput('hosts', 'website.com,');
      await istioConfigWizardPage.expectInputWarning('name', true);
      await istioConfigWizardPage.expectInputWarning('hosts', true);
      await istioConfigWizardPage.expectPreviewButtonDisabled();
    }
  );

  test(
    'Try to create a ServiceEntry without ports specified',
    coreCachingOnly,
    async ({ istioConfigPage, istioConfigWizardPage }) => {
      deleteServiceEntry('myservice', namespace);
      await istioConfigPage.clickCreateIstioConfigAction('ServiceEntry');
      await istioConfigWizardPage.expectConfigWizard('Create ServiceEntry');
      await istioConfigWizardPage.typesInInput('name', 'myservice');
      await istioConfigWizardPage.typesInInput('hosts', 'website.com,website2.com');
      await istioConfigWizardPage.expectMessage('ServiceEntry has no Ports defined');
      await istioConfigWizardPage.expectPreviewButtonDisabled();
    }
  );

  test(
    'Try to create a ServiceEntry with empty ports specified',
    coreCachingOnly,
    async ({ istioConfigPage, istioConfigWizardPage }) => {
      await istioConfigPage.clickCreateIstioConfigAction('ServiceEntry');
      await istioConfigWizardPage.expectConfigWizard('Create ServiceEntry');
      await istioConfigWizardPage.typesInInput('name', 'myservice');
      await istioConfigWizardPage.typesInInput('hosts', 'website.com');
      await istioConfigWizardPage.openSubmenu('Add Port');
      await istioConfigWizardPage.expectInputEmpty('addPortNumber_0');
      await istioConfigWizardPage.expectInputWarning('addPortNumber_0', true);
      await istioConfigWizardPage.expectInputEmpty('addPortName_0');
      await istioConfigWizardPage.expectInputWarning('addPortName_0', true);
      await istioConfigWizardPage.expectInputEmpty('addTargetPort_0');
      await istioConfigWizardPage.expectInputWarning('addTargetPort_0', false);
      await istioConfigWizardPage.expectPreviewButtonDisabled();
    }
  );

  test(
    'Create a ServiceEntry with ports specified',
    coreCachingOnly,
    async ({ istioConfigPage, istioConfigWizardPage }) => {
      deleteServiceEntry('myservice2', namespace);
      await istioConfigPage.clickCreateIstioConfigAction('ServiceEntry');
      await istioConfigWizardPage.expectConfigWizard('Create ServiceEntry');
      await istioConfigWizardPage.typesInInput('name', 'myservice2');
      await istioConfigWizardPage.typesInInput('hosts', 'website.com,website2.com');
      await istioConfigWizardPage.openSubmenu('Add Port');
      await istioConfigWizardPage.expectInputEmpty('addPortNumber_0');
      await istioConfigWizardPage.typesInInput('addPortNumber_0', '8080');
      await istioConfigWizardPage.typesInInput('addPortName_0', 'foobar');
      await istioConfigWizardPage.typesInInput('addTargetPort_0', '8080');
      await istioConfigWizardPage.previewConfiguration();
      await istioConfigWizardPage.createIstioConfig();
      await istioConfigPage.expectObjectListed('ServiceEntry', 'myservice2', namespace);
    }
  );

  test(
    'Try to create duplicate port specifications on a ServiceEntry',
    coreCachingOnly,
    async ({ istioConfigPage, istioConfigWizardPage }) => {
      await istioConfigPage.clickCreateIstioConfigAction('ServiceEntry');
      await istioConfigWizardPage.expectConfigWizard('Create ServiceEntry');
      await istioConfigWizardPage.typesInInput('name', 'myservice2');
      await istioConfigWizardPage.typesInInput('hosts', 'website.com,website2.com');
      await istioConfigWizardPage.openSubmenu('Add Port');
      await istioConfigWizardPage.typesInInput('addPortNumber_0', '8080');
      await istioConfigWizardPage.typesInInput('addPortName_0', 'foobar');
      await istioConfigWizardPage.typesInInput('addTargetPort_0', '8080');
      await istioConfigWizardPage.openSubmenu('Add Port');
      await istioConfigWizardPage.typesInInput('addPortNumber_1', '8080');
      await istioConfigWizardPage.typesInInput('addPortName_1', 'foobar');
      await istioConfigWizardPage.typesInInput('addTargetPort_1', '8080');
      await istioConfigWizardPage.expectPreviewButtonDisabled();
    }
  );

  test(
    'Create a ServiceEntry and view the service detail page of the external service associated',
    coreCachingOnly,
    async ({ istioConfigPage, istioConfigWizardPage, serviceDetailsPage, servicesPage, page }) => {
      deleteServiceEntry('myservice3', namespace);
      await istioConfigPage.clickCreateIstioConfigAction('ServiceEntry');
      await istioConfigWizardPage.expectConfigWizard('Create ServiceEntry');
      await istioConfigWizardPage.typesInInput('name', 'myservice3');
      await istioConfigWizardPage.typesInInput('hosts', 'host.com');
      await istioConfigWizardPage.openSubmenu('Add Port');
      await istioConfigWizardPage.typesInInput('addPortNumber_0', '8080');
      await istioConfigWizardPage.typesInInput('addPortName_0', 'foobar');
      await istioConfigWizardPage.typesInInput('addTargetPort_0', '8080');
      await istioConfigWizardPage.previewConfiguration();
      await istioConfigWizardPage.createIstioConfig();
      await istioConfigPage.expectObjectListed('ServiceEntry', 'myservice3', namespace);

      await servicesPage.openList();
      await selectNamespace(page, namespace);
      await page
        .getByRole('row', { name: /host\.com/ })
        .getByRole('link')
        .first()
        .click();
      await serviceDetailsPage.expectResourcesCard();
      await expect(page.getByTestId('service-details-card')).toContainText('External Service');
      await expect(page.locator('#IstioConfigCard')).toContainText('myservice3');
    }
  );
});

import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { isIstioInjectionUiEnabled } from '../../utils/kialiConfig';
import {
  clearNamespaceInjection,
  ensureWorkloadHasInjectionOverride,
  setNamespaceInjection,
  setupWorkloadWithInjectionOverride,
  setupWorkloadWithSidecar,
  setupWorkloadWithoutSidecar
} from '../../utils/sidecarInjection';
import { core2 } from '../../utils/suite-tags';

const namespace = 'sleep';
const workload = 'sleep';

test.describe('Namespace sidecar injection', () => {
  test.beforeEach(async ({ page, request }) => {
    ensureDemoApp('sleep');
    test.skip(!(await isIstioInjectionUiEnabled(request)), 'Sidecar injection UI is disabled in Kiali config');
    await clearNamespaceInjection(page, namespace);
  });

  test(
    'Override the default policy for automatic sidecar injection by enabling it in a namespace',
    core2,
    async ({ namespaceDetailPage }) => {
      await namespaceDetailPage.open(namespace);
      test.skip(
        !(await namespaceDetailPage.hasSidecarInjectionAction('enable')),
        'Enable sidecar injection is not available (ambient-only cluster?)'
      );
      await namespaceDetailPage.enableNamespaceInjection();
      await namespaceDetailPage.expectNamespaceInjectionLabel('enabled');
    }
  );

  test(
    'Switch the override configuration for automatic sidecar injection in a namespace to disabled',
    core2,
    async ({ namespaceDetailPage, page }) => {
      await setNamespaceInjection(page, namespace, 'enabled');
      await namespaceDetailPage.open(namespace);
      test.skip(
        !(await namespaceDetailPage.hasSidecarInjectionAction('disable')),
        'Disable sidecar injection is not available (ambient-only cluster?)'
      );
      await namespaceDetailPage.disableNamespaceInjection();
      await namespaceDetailPage.expectNamespaceInjectionLabel('disabled');
    }
  );

  test(
    'Switch the override configuration for automatic sidecar injection in a namespace to enabled',
    core2,
    async ({ namespaceDetailPage, page }) => {
      await setNamespaceInjection(page, namespace, 'disabled');
      await namespaceDetailPage.open(namespace);
      test.skip(
        !(await namespaceDetailPage.hasSidecarInjectionAction('enable')),
        'Enable sidecar injection is not available (ambient-only cluster?)'
      );
      await namespaceDetailPage.enableNamespaceInjection();
      await namespaceDetailPage.expectNamespaceInjectionLabel('enabled');
    }
  );

  test(
    'Switch to using the default policy for automatic sidecar injection in a namespace',
    core2,
    async ({ namespaceDetailPage, page }) => {
      await setNamespaceInjection(page, namespace, 'enabled');
      await namespaceDetailPage.open(namespace);
      test.skip(
        !(await namespaceDetailPage.hasSidecarInjectionAction('remove')),
        'Remove sidecar injection is not available (ambient-only cluster?)'
      );
      await namespaceDetailPage.removeNamespaceInjection();
      await namespaceDetailPage.expectNamespaceInjectionLabel('absent');
    }
  );
});

test.describe('Workload sidecar injection', () => {
  test.beforeEach(async ({ request }) => {
    ensureDemoApp('sleep');
    test.skip(!(await isIstioInjectionUiEnabled(request)), 'Sidecar injection UI is disabled in Kiali config');
  });

  test(
    'Override the default policy for automatic sidecar injection by enabling it in a workload',
    core2,
    async ({ workloadDetailsPage, page }) => {
      await setupWorkloadWithoutSidecar(page, namespace, workload);
      await workloadDetailsPage.open(namespace, workload);
      await workloadDetailsPage.clickSidecarActionAndRestart('enable_auto_injection', namespace, workload);
      await workloadDetailsPage.expectMissingSidecarBadge(false, namespace, workload);
    }
  );

  test(
    'Override the default policy for automatic sidecar injection by disabling it in a workload',
    core2,
    async ({ workloadDetailsPage, page }) => {
      await setupWorkloadWithSidecar(page, namespace, workload);
      await workloadDetailsPage.open(namespace, workload);
      await workloadDetailsPage.clickSidecarActionAndRestart('disable_auto_injection', namespace, workload);
      await workloadDetailsPage.expectMissingSidecarBadge(true, namespace, workload);
    }
  );

  test(
    'Switch the override configuration for automatic sidecar injection in a workload to disabled',
    core2,
    async ({ workloadDetailsPage, page }) => {
      await setupWorkloadWithSidecar(page, namespace, workload);
      await ensureWorkloadHasInjectionOverride(page, namespace, workload, true);
      await workloadDetailsPage.open(namespace, workload);
      await workloadDetailsPage.clickSidecarActionAndRestart('disable_auto_injection', namespace, workload);
      await workloadDetailsPage.expectMissingSidecarBadge(true, namespace, workload);
    }
  );

  test(
    'Switch the override configuration for automatic sidecar injection in a workload to enabled',
    core2,
    async ({ workloadDetailsPage, page }) => {
      await setupWorkloadWithoutSidecar(page, namespace, workload);
      await ensureWorkloadHasInjectionOverride(page, namespace, workload, false);
      await workloadDetailsPage.open(namespace, workload);
      await workloadDetailsPage.clickSidecarActionAndRestart('enable_auto_injection', namespace, workload);
      await workloadDetailsPage.expectMissingSidecarBadge(false, namespace, workload);
    }
  );

  test(
    'Remove override configuration for automatic sidecar injection in a workload',
    core2,
    async ({ workloadDetailsPage, page }) => {
      await setupWorkloadWithInjectionOverride(page, namespace, workload);
      await workloadDetailsPage.open(namespace, workload);
      await workloadDetailsPage.clickSidecarActionAndRestart('remove_auto_injection', namespace, workload);
      await workloadDetailsPage.expectNoWorkloadInjectionLabel();
    }
  );
});

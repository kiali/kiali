import { execSync } from 'child_process';
import { test } from '../../fixtures/kialiFixtures';
import { selectNamespace } from '../../utils/namespace';
import { waitForAppHealthStatus } from '../../utils/health';
import { core1 } from '../../utils/suite-tags';

test.describe('Apps list', () => {
  test.beforeEach(async ({ appsPage, page }) => {
    await appsPage.openList();
    await selectNamespace(page, 'bookinfo');
  });

  test('See all Apps objects in the bookinfo namespace', core1, async ({ appsPage }) => {
    await appsPage.expectBookinfoAppsListed();
    await appsPage.expectAppsColumnInformation();
    await appsPage.expectColumn('Cluster', false);
  });

  test('See all Apps toggles', core1, async ({ appsPage }) => {
    await appsPage.expectAllAppsTogglesChecked();
  });

  test('Toggle Apps health toggle', core1, async ({ appsPage }) => {
    await appsPage.setToggle('health', false);
    await appsPage.expectColumn('Health', false);
    await appsPage.setToggle('health', true);
    await appsPage.expectColumn('Health', true);
  });

  test('Filter Apps by Istio Name', core1, async ({ appsPage }) => {
    await appsPage.filterBy('App Name', 'productpage');
    await appsPage.expectOnlyRow('productpage');
  });

  test('Filter Apps by Istio Sidecar', core1, async ({ appsPage }) => {
    await appsPage.filterBy('Istio Sidecar', 'Present');
    await appsPage.expectRows('productpage', 'details', 'reviews', 'ratings');
  });

  test('Filter Apps by Istio Sidecar not present', core1, async ({ appsPage }) => {
    await appsPage.filterBy('Istio Sidecar', 'Not Present');
    await appsPage.expectRows('kiali-traffic-generator');
  });

  test('Filter Apps by Istio Config Type', core1, async ({ appsPage }) => {
    await appsPage.filterBy('Istio Config Type', 'VirtualService');
    await appsPage.expectOnlyRow('productpage');
  });

  test('Filter Apps by Health', core1, async ({ appsPage }) => {
    await appsPage.filterBy('Health', 'Healthy');
    await appsPage.expectOnlyHealthyApps();
  });

  test('Filter Applications table by Label', core1, async ({ appsPage }) => {
    await appsPage.filterBy('Label', 'app=reviews');
    await appsPage.expectRows('reviews');
    await appsPage.expectOnlyAppsNamed('reviews');
  });

  test('The healthy status of a logical mesh application is reported in the list', core1, async ({ appsPage }) => {
    await appsPage.expectApplicationListedAs('bookinfo', 'details', 'healthy');
  });
});

test.describe('Apps list idle health', () => {
  test.afterEach(() => {
    execSync('kubectl scale -n sleep --replicas=1 deployment/sleep', { stdio: 'ignore' });
  });

  test(
    'The idle status of a logical mesh application is reported in the list',
    core1,
    async ({ appsPage, page, request }) => {
      execSync('kubectl scale -n sleep --replicas=0 deployment/sleep', { stdio: 'ignore' });
      await waitForAppHealthStatus(request, 'sleep', 'sleep', 'Not Ready');
      await appsPage.openList();
      await selectNamespace(page, 'sleep');
      await appsPage.expectApplicationListedAs('sleep', 'sleep', 'idle');
      await appsPage.expectApplicationHealthStatus('sleep', 'sleep', 'Not Ready');
    }
  );
});

test.describe('Apps list health statuses', () => {
  test(
    'The failing status of a logical mesh application is reported in the list',
    core1,
    async ({ appsPage, page, request }) => {
      await waitForAppHealthStatus(request, 'alpha', 'v-server', 'Failure');
      await appsPage.openList();
      await selectNamespace(page, 'alpha');
      await appsPage.expectApplicationListedAs('alpha', 'v-server', 'failure');
      await appsPage.expectApplicationHealthStatus('alpha', 'v-server', 'Failure');
    }
  );

  test(
    'The degraded status of a logical mesh application is reported in the list',
    core1,
    async ({ appsPage, page, request }) => {
      await waitForAppHealthStatus(request, 'alpha', 'b-client', 'Degraded');
      await appsPage.openList();
      await selectNamespace(page, 'alpha');
      await appsPage.expectApplicationListedAs('alpha', 'b-client', 'degraded');
      await appsPage.expectApplicationHealthStatus('alpha', 'b-client', 'Degraded');
    }
  );
});

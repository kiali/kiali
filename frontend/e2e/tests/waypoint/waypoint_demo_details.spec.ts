import { expect } from '@playwright/test';
import { test } from '../../fixtures/kialiFixtures';
import { prepareBookinfoWaypoint } from '../../utils/waypointHelpers';
import { waypointOnly } from '../../utils/suite-tags';

test.describe('Waypoint demo-namespace details', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    test.setTimeout(900_000);
    await prepareBookinfoWaypoint(request);
  });

  test('waypoint for none details', waypointOnly, async ({ page, workloadDetailsPage }) => {
    await workloadDetailsPage.open('waypoint-fornone', 'curl-client');
    await workloadDetailsPage.expectNoL7WaypointLink();
    await workloadDetailsPage.open('waypoint-fornone', 'waypoint');
    await workloadDetailsPage.openWaypointTab();
    await workloadDetailsPage.expectWaypointSubtabAbsent('Services');
    await workloadDetailsPage.expectWaypointSubtabAbsent('Workloads');
    await workloadDetailsPage.openWaypointSubtab('Info');
    await workloadDetailsPage.expectWaypointInfoFor('none');
    await expect(page.getByTestId('waypointfor-title')).toBeVisible();
  });

  test('waypoint for service details', waypointOnly, async ({ page, workloadDetailsPage }) => {
    await workloadDetailsPage.open('waypoint-forservice', 'curl-client');
    await workloadDetailsPage.expectL7WaypointLink('waypoint');
    await workloadDetailsPage.clickL7WaypointLink('waypoint');
    await expect(page).toHaveURL(/\/workloads\/waypoint/);
    await workloadDetailsPage.openWaypointTab();
    await workloadDetailsPage.openWaypointSubtab('Services');
    await workloadDetailsPage.expectEnrolledWaypointTable({
      rows: 1,
      name: 'echo-service',
      namespace: 'waypoint-forservice',
      labeledBy: 'namespace',
      badgeId: 'pfbadge-S'
    });
    await workloadDetailsPage.openWaypointSubtab('Info');
    await workloadDetailsPage.expectWaypointInfoFor('service');
  });

  test('waypoint differentns details', waypointOnly, async ({ page, workloadDetailsPage }) => {
    await workloadDetailsPage.open('waypoint-differentns', 'curl-client');
    await workloadDetailsPage.expectL7WaypointLink('egress-gateway');
    await workloadDetailsPage.clickL7WaypointLink('egress-gateway');
    await expect(page).toHaveURL(/\/workloads\/egress-gateway/);
    await workloadDetailsPage.openWaypointTab();
    await workloadDetailsPage.openWaypointSubtab('Services');
    await workloadDetailsPage.expectEnrolledWaypointTable({
      rows: 1,
      name: 'echo-service',
      namespace: 'waypoint-differentns',
      labeledBy: 'namespace',
      badgeId: 'pfbadge-S'
    });
    await workloadDetailsPage.openWaypointSubtab('Info');
    await workloadDetailsPage.expectWaypointInfoFor('service');
  });

  test('waypoint for all details', waypointOnly, async ({ page, workloadDetailsPage }) => {
    await workloadDetailsPage.open('waypoint-forall', 'curl-client');
    await workloadDetailsPage.expectL7WaypointLink('cgw');
    await workloadDetailsPage.clickL7WaypointLink('cgw');
    await expect(page).toHaveURL(/\/workloads\/cgw/);
    await workloadDetailsPage.openWaypointTab();
    await workloadDetailsPage.openWaypointSubtab('Services');
    await workloadDetailsPage.expectEnrolledWaypointTable({
      rows: 1,
      name: 'echo-service',
      namespace: 'waypoint-forall',
      labeledBy: 'namespace',
      badgeId: 'pfbadge-S'
    });
    await workloadDetailsPage.openWaypointSubtab('Workloads');
    await workloadDetailsPage.expectEnrolledWaypointTable({
      rows: 2,
      name: 'echo-server',
      namespace: 'waypoint-forall',
      labeledBy: 'namespace',
      badgeId: 'pfbadge-W'
    });
    await workloadDetailsPage.openWaypointSubtab('Info');
    await workloadDetailsPage.expectWaypointInfoFor('all');
  });

  test('waypoint for workload details', waypointOnly, async ({ page, workloadDetailsPage }) => {
    await workloadDetailsPage.open('waypoint-forworkload', 'echo-server');
    await workloadDetailsPage.expectL7WaypointLink('bwaypoint');
    await workloadDetailsPage.clickL7WaypointLink('bwaypoint');
    await expect(page).toHaveURL(/\/workloads\/bwaypoint/);
    await workloadDetailsPage.openWaypointTab();
    await workloadDetailsPage.openWaypointSubtab('Workloads');
    await workloadDetailsPage.expectEnrolledWaypointTable({
      rows: 1,
      name: 'echo-server',
      namespace: 'waypoint-forworkload',
      labeledBy: 'workload',
      badgeId: 'pfbadge-W'
    });
    await workloadDetailsPage.openWaypointSubtab('Info');
    await workloadDetailsPage.expectWaypointInfoFor('workload');
  });

  test('waypoint override details', waypointOnly, async ({ page, workloadDetailsPage }) => {
    await workloadDetailsPage.open('waypoint-override', 'curl-client');
    await workloadDetailsPage.expectL7WaypointLink('waypoint');
    await workloadDetailsPage.clickL7WaypointLink('waypoint');
    await expect(page).toHaveURL(/\/workloads\/waypoint/);
    await workloadDetailsPage.openWaypointTab();
    await workloadDetailsPage.openWaypointSubtab('Services');
    await workloadDetailsPage.expectEnrolledWaypointTable({
      rows: 1,
      name: 'echo-service',
      namespace: 'waypoint-override',
      labeledBy: 'namespace',
      badgeId: 'pfbadge-S'
    });
    await workloadDetailsPage.openWaypointSubtab('Info');
    await workloadDetailsPage.expectWaypointInfoFor('service');

    await workloadDetailsPage.open('waypoint-override', 'echo-server');
    await workloadDetailsPage.expectL7WaypointLink('use-this');
    await workloadDetailsPage.clickL7WaypointLink('use-this');
    await expect(page).toHaveURL(/\/workloads\/use-this/);
    await workloadDetailsPage.openWaypointTab();
    await workloadDetailsPage.openWaypointSubtab('Services');
    await workloadDetailsPage.expectEnrolledWaypointTable({
      rows: 1,
      name: 'echo-service',
      namespace: 'waypoint-override',
      labeledBy: 'service',
      badgeId: 'pfbadge-S'
    });
    await workloadDetailsPage.openWaypointSubtab('Info');
    await workloadDetailsPage.expectWaypointInfoFor('service');
  });
});

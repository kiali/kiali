import { test } from '../../fixtures/kialiFixtures';

/**
 * Migrated from cypress/integration/featureFiles/graph_display.feature (@smoke).
 */
test.describe('Graph display', () => {
  test('Graph shows empty state when Prometheus is disabled @smoke @prometheus-disabled', async ({ graphPage }) => {
    await graphPage.openWithPrometheusDisabled();
    await graphPage.expectPrometheusDisabledEmptyState();
  });
});

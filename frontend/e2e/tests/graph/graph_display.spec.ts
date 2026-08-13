import { test } from '../../fixtures/kialiFixtures';
import { smokeAndPrometheusDisabled } from '../../utils/suite-tags';

test.describe('Graph display', () => {
  test('Graph shows empty state when Prometheus is disabled', smokeAndPrometheusDisabled, async ({ graphPage }) => {
    await graphPage.openWithPrometheusDisabled();
    await graphPage.expectPrometheusDisabledEmptyState();
  });
});

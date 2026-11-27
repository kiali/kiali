import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { waypointTracingOnly } from '../../utils/suite-tags';
import {
  expectTraceScatterplot,
  expectTraceTooltipHeatmap,
  hoverTraceScatterplotWithMinSpans,
  openTracesTab,
  waitForTracesViaApi
} from '../../utils/tracingHelpers';

test.describe('Waypoint tracing tooltip heat map', () => {
  test.describe.configure({ timeout: 240_000 });

  test('Reviews app scatterplot heat map tooltip', waypointTracingOnly, async ({ appDetailsPage, page, request }) => {
    ensureDemoApp('bookinfo');
    await waitForTracesViaApi(request, 'app', 'bookinfo', 'reviews', 4);
    await appDetailsPage.openApp('bookinfo', 'reviews');
    await openTracesTab(page);
    await expectTraceScatterplot(page);
    await hoverTraceScatterplotWithMinSpans(page, 4);
    await expectTraceTooltipHeatmap(page);
  });

  test(
    'Reviews service scatterplot heat map tooltip',
    waypointTracingOnly,
    async ({ serviceDetailsPage, page, request }) => {
      ensureDemoApp('bookinfo');
      await waitForTracesViaApi(request, 'service', 'bookinfo', 'reviews', 4);
      await serviceDetailsPage.open('bookinfo', 'reviews');
      await openTracesTab(page);
      await expectTraceScatterplot(page);
      await hoverTraceScatterplotWithMinSpans(page, 4);
      await expectTraceTooltipHeatmap(page);
    }
  );

  test(
    'Reviews-v2 workload scatterplot heat map tooltip',
    waypointTracingOnly,
    async ({ workloadDetailsPage, page, request }) => {
      ensureDemoApp('bookinfo');
      await waitForTracesViaApi(request, 'workload', 'bookinfo', 'reviews-v2', 4);
      await workloadDetailsPage.open('bookinfo', 'reviews-v2');
      await openTracesTab(page);
      await expectTraceScatterplot(page);
      await hoverTraceScatterplotWithMinSpans(page, 4);
      await expectTraceTooltipHeatmap(page);
    }
  );
});

import { expect, type Page } from '@playwright/test';

import { openDetailsTab } from './detailsPage';
import { clickRefreshAndWait } from './transition';

const TRAFFIC_TAB = 'Traffic';

const TRAFFIC_RETRY = { intervals: [10_000], timeout: 120_000 };

export type DetailsTrafficExpectation = {
  /** Assert the outbound empty-state message is shown (workload details). */
  expectEmptyOutbound?: boolean;
  /** Retry until the inbound traffic list/grid contains this pattern. */
  inboundListContent?: RegExp;
  /** Retry until the outbound traffic list/grid contains this pattern. */
  outboundListContent?: RegExp;
  /** Require inbound and outbound traffic grids to be visible (service details). */
  requireBothTrafficGrids?: boolean;
  /** Require inbound rows (no "No Inbound Traffic"). Default true. */
  requireInboundRows?: boolean;
  /** Require the "Outbound Traffic" section heading. Default true unless expectEmptyOutbound. */
  requireOutboundHeading?: boolean;
  /** Require outbound rows (no "No Outbound Traffic"). */
  requireOutboundRows?: boolean;
  /** Scope inbound empty-state checks to the inbound traffic card (service details). */
  scopeInboundToTrafficCard?: boolean;
};

async function expectTrafficList(page: Page, gridName: string, pattern: RegExp): Promise<void> {
  const grid = page.getByRole('grid', { name: gridName });
  await expect(grid).toBeVisible();
  await expect(async () => {
    const text = (await grid.textContent()) ?? '';
    if (!pattern.test(text)) {
      await clickRefreshAndWait(page);
      await openDetailsTab(page, TRAFFIC_TAB);
      throw new Error(`${gridName} not populated yet`);
    }
    await expect(grid).toContainText(pattern);
  }).toPass(TRAFFIC_RETRY);
}

/**
 * Open the Traffic tab and retry with page refresh until telemetry headings and optional list
 * content match. Shared by app, service, and workload details page objects.
 */
export async function expectDetailsTrafficTab(page: Page, options: DetailsTrafficExpectation = {}): Promise<void> {
  const {
    expectEmptyOutbound = false,
    inboundListContent,
    outboundListContent,
    requireBothTrafficGrids = false,
    requireInboundRows = true,
    requireOutboundHeading = !expectEmptyOutbound,
    requireOutboundRows = false,
    scopeInboundToTrafficCard = false
  } = options;

  await openDetailsTab(page, TRAFFIC_TAB);

  await expect(async () => {
    const trafficCard = scopeInboundToTrafficCard
      ? page.locator('.pf-v6-c-card__body').filter({ hasText: 'Inbound Traffic' })
      : null;
    const inboundHeading =
      trafficCard !== null ? trafficCard.getByText('Inbound Traffic') : page.getByText('Inbound Traffic').first();
    const noInbound =
      trafficCard !== null ? trafficCard.getByText('No Inbound Traffic') : page.getByText('No Inbound Traffic');
    const noOutbound = page.getByText('No Outbound Traffic');
    const outboundHeading = page.getByText('Outbound Traffic').first();

    const inboundHeadingVisible = await inboundHeading.isVisible();
    const outboundHeadingVisible = requireOutboundHeading ? await outboundHeading.isVisible() : true;
    const inboundEmpty = requireInboundRows && (await noInbound.count()) > 0;
    const outboundUnexpectedEmpty = requireOutboundRows && (await noOutbound.count()) > 0;
    const outboundMissingEmpty = expectEmptyOutbound && (await noOutbound.count()) === 0;

    if (
      !inboundHeadingVisible ||
      !outboundHeadingVisible ||
      inboundEmpty ||
      outboundUnexpectedEmpty ||
      outboundMissingEmpty
    ) {
      await clickRefreshAndWait(page);
      await openDetailsTab(page, TRAFFIC_TAB);
      throw new Error('traffic tab not populated yet');
    }

    await expect(inboundHeading).toBeVisible();
    if (requireInboundRows) {
      await expect(noInbound).toHaveCount(0);
    }
    if (requireOutboundHeading) {
      await expect(outboundHeading).toBeVisible();
    }
    if (requireOutboundRows) {
      await expect(noOutbound).toHaveCount(0);
    }
    if (expectEmptyOutbound) {
      await expect(noOutbound).toBeVisible();
    }
  }).toPass(TRAFFIC_RETRY);

  if (requireBothTrafficGrids) {
    await expect(page.getByRole('grid', { name: 'Inbound Traffic List' })).toBeVisible();
    await expect(page.getByRole('grid', { name: 'Outbound Traffic List' })).toBeVisible();
  }

  if (inboundListContent) {
    await expectTrafficList(page, 'Inbound Traffic List', inboundListContent);
  }
  if (outboundListContent) {
    await expectTrafficList(page, 'Outbound Traffic List', outboundListContent);
  }
}

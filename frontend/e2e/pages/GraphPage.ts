import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { waitForLoadingComplete } from '../utils/transition';
import { expectGraphTopology, readGraphTopology } from '../utils/graphTopology';
import { EdgeAttr, NodeAttr, select, selectAnd, selectOr } from '../utils/graphSelect';

const DISPLAY_OPTION_IDS: Record<string, string> = {
  'cluster boxes': 'boxByCluster',
  'idle edges': 'filterIdleEdges',
  'idle nodes': 'filterIdleNodes',
  'missing sidecars': 'filterSidecars',
  'namespace boxes': 'boxByNamespace',
  'operation nodes': 'filterOperationNodes',
  rank: 'rank',
  'service nodes': 'filterServiceNodes',
  security: 'filterSecurity',
  'traffic animation': 'filterTrafficAnimation',
  'virtual services': 'filterVS',
  'waypoint proxies': 'filterWaypoints'
};

const WIZARD_TITLES: Record<string, string> = {
  request_routing: 'Request Routing',
  fault_injection: 'Fault Injection',
  traffic_shifting: 'Traffic Shifting',
  tcp_traffic_shifting: 'TCP Traffic Shifting',
  request_timeouts: 'Request Timeouts'
};

export class GraphPage extends BasePage {
  /**
   * Visit graph with prometheus.enabled=false mocked via the config API route.
   */
  async openWithPrometheusDisabled(): Promise<void> {
    await this.page.route('**/api/config', async route => {
      const response = await route.fetch();
      const body = await response.json();
      body.prometheus = {
        ...body.prometheus,
        enabled: false,
        disabledReason: ''
      };
      await route.fulfill({ response, json: body });
    });

    await this.page.goto('/console/graph/namespaces?refresh=0');
    await waitForLoadingComplete(this.page);
  }

  async expectPrometheusDisabledEmptyState(): Promise<void> {
    await expect(this.page.locator('#empty-graph-prometheus-disabled')).toBeVisible();
  }

  async graphNamespaces(namespaces: string, refresh = '0', duration?: string): Promise<void> {
    const params = new URLSearchParams({ refresh, namespaces });
    if (duration) {
      params.set('duration', duration);
    }
    const graphResponse =
      namespaces !== ''
        ? this.page.waitForResponse(
            response => response.url().includes('/api/namespaces/graph') && response.request().method() === 'GET'
          )
        : null;

    await this.page.goto(`/console/graph/namespaces?${params.toString()}`);
    if (graphResponse) {
      await graphResponse;
    }
    await waitForLoadingComplete(this.page);
  }

  async expectNoNamespaceSelected(): Promise<void> {
    await expect(this.page.locator('#empty-graph-no-namespace')).toBeVisible();
  }

  async expectEmptyGraph(): Promise<void> {
    await expect(this.page.locator('#empty-graph')).toBeVisible();
  }

  async expectNamespaceInSummaryPanel(namespace: string): Promise<void> {
    await expectGraphTopology(this.page, () => {});
    await expect(this.page.locator(`div#summary-panel-graph div#ns-${namespace}`)).toBeVisible();
  }

  async openDisplayMenu(): Promise<void> {
    await waitForLoadingComplete(this.page);
    const button = this.page.locator('button#display-settings');
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await button.click();
  }

  async closeDisplayMenu(): Promise<void> {
    await this.openDisplayMenu();
  }

  async expectDisplayMenuOpen(): Promise<void> {
    await expect(this.page.locator('button#display-settings')).toHaveAttribute('aria-expanded', 'true');
    await expect(this.page.locator('#graph-display-menu')).toBeAttached();
  }

  async expectDisplayMenuDefaultSettings(): Promise<void> {
    const menu = this.page.locator('#graph-display-menu');
    await expect(menu.locator('input#responseTime')).not.toBeChecked();
    await expect(menu.locator('input#throughput')).not.toBeChecked();
    await expect(menu.locator('input#trafficDistribution')).not.toBeChecked();
    await expect(menu.locator('input#trafficRate')).not.toBeChecked();
    await expect(menu.locator('input#boxByCluster')).toBeChecked();
    await expect(menu.locator('input#boxByNamespace')).toBeChecked();
    await expect(menu.locator('input#filterIdleEdges')).not.toBeChecked();
    await expect(menu.locator('input#filterIdleNodes')).not.toBeChecked();
    await expect(menu.locator('input#filterOperationNodes')).not.toBeChecked();
    await expect(menu.locator('input#rank')).not.toBeChecked();
    await expect(menu.locator('input#filterServiceNodes')).toBeChecked();
    await expect(menu.locator('input#filterTrafficAnimation')).not.toBeChecked();
    await expect(menu.locator('input#filterSidecars')).toBeChecked();
    await expect(menu.locator('input#filterSecurity')).not.toBeChecked();
    await expect(menu.locator('input#filterVS')).toBeChecked();
  }

  async expectGraphReflectsDefaultSettings(): Promise<void> {
    await expectGraphTopology(this.page, ({ nodes, edges }) => {
      const edgeElems = edges.map(e => ({ data: e.data }));
      const nodeElems = nodes.map(n => ({ data: n.data }));

      expect(
        selectOr(edgeElems, [
          [{ prop: EdgeAttr.responseTime, op: 'truthy' }],
          [{ prop: EdgeAttr.throughput, op: 'truthy' }]
        ]).length
      ).toBe(0);

      expect(
        selectOr(edgeElems, [
          [{ prop: EdgeAttr.hasTraffic, op: 'falsy' }],
          [{ prop: EdgeAttr.isMTLS, op: '=', val: undefined }]
        ]).length
      ).toBe(0);

      expect(select(nodeElems, { prop: NodeAttr.isBox, op: '=', val: 'app' }).length).toBeGreaterThan(0);
      expect(select(nodeElems, { prop: NodeAttr.isBox, op: '=', val: 'namespace' }).length).toBeGreaterThan(0);
      expect(select(nodeElems, { prop: NodeAttr.nodeType, op: '=', val: 'service' }).length).toBeGreaterThan(0);

      expect(
        selectOr(nodeElems, [
          [{ prop: NodeAttr.isBox, op: '=', val: 'cluster' }],
          [{ prop: NodeAttr.isIdle, op: 'truthy' }],
          [{ prop: NodeAttr.rank, op: 'truthy' }],
          [{ prop: NodeAttr.nodeType, op: '=', val: 'operation' }]
        ]).length
      ).toBe(0);
    });
  }

  async enableEdgeLabels(radioId: string, edgeLabelId: string): Promise<void> {
    const menu = this.page.locator('#graph-display-menu');
    await menu.locator(`input#${edgeLabelId}`).check();
    await menu.locator(`input#${radioId}`).check();
    await waitForLoadingComplete(this.page);
  }

  async setEdgeLabels(edgeLabelId: string, enabled: boolean): Promise<void> {
    const input = this.page.locator('#graph-display-menu').locator(`input#${edgeLabelId}`);
    if (enabled) {
      await input.check();
    } else {
      await input.uncheck();
    }
    await waitForLoadingComplete(this.page);
  }

  async expectEdgeLabelsVisible(edgeLabel: string): Promise<void> {
    await this.expectDisplayOptionChecked(edgeLabel === 'responseTime' ? 'responseTime' : edgeLabel, true);

    let rate = edgeLabel;
    if (edgeLabel === 'trafficDistribution') {
      rate = 'httpPercentReq';
    } else if (edgeLabel === 'trafficRate') {
      rate = 'http';
    }

    await expectGraphTopology(this.page, ({ edges }) => {
      const edgeElems = edges.map(e => ({ data: e.data }));
      expect(select(edgeElems, { prop: rate, op: '>', val: 0 }).length).toBeGreaterThan(0);
    });
  }

  async expectEdgeLabelOptionClosed(edgeLabel: string): Promise<void> {
    await this.expectDisplayOptionChecked(edgeLabel, false);
  }

  async setDisplayOption(optionName: string, enabled: boolean): Promise<void> {
    const optionId = DISPLAY_OPTION_IDS[optionName.toLowerCase()] ?? optionName;
    const clientOnly = ['filterTrafficAnimation', 'filterSidecars', 'rank'];
    const graphResponse = clientOnly.includes(optionId)
      ? null
      : this.page.waitForResponse(
          response => response.url().includes('/api/namespaces/graph') && response.request().method() === 'GET'
        );

    const input = this.page.locator('#graph-display-menu').locator(`input#${optionId}`);
    if (enabled) {
      await input.check();
      if (optionId === 'rank') {
        await this.page.locator('#graph-display-menu input#inboundEdges').check();
      }
    } else {
      await input.uncheck();
    }

    if (graphResponse) {
      await graphResponse;
    }
    await waitForLoadingComplete(this.page);
  }

  private async expectDisplayOptionChecked(optionId: string, checked: boolean): Promise<void> {
    const input = this.page.locator('#graph-display-menu').locator(`input#${optionId}`);
    await expect(input).toBeAttached();
    if (checked) {
      await expect(input).toBeChecked();
    } else {
      await expect(input).not.toBeChecked();
    }
    await expect(input).toBeEnabled();
  }

  async expectNoBoxing(boxType: string): Promise<void> {
    const optionId = `boxBy${boxType}`;
    await this.expectDisplayOptionChecked(optionId, false);
    await expectGraphTopology(this.page, ({ nodes }) => {
      const nodeElems = nodes.map(n => ({ data: n.data }));
      expect(select(nodeElems, { prop: NodeAttr.isBox, op: '=', val: boxType.toLowerCase() }).length).toBe(0);
    });
  }

  async expectIdleEdges(action: 'appear' | 'do not appear'): Promise<void> {
    await this.expectDisplayOptionChecked('filterIdleEdges', action === 'appear');
    await expectGraphTopology(this.page, ({ edges }) => {
      const edgeElems = edges.map(e => ({ data: e.data }));
      const numEdges = select(edgeElems, { prop: EdgeAttr.hasTraffic, op: '!=', val: undefined }).length;
      const numIdleEdges = select(edgeElems, { prop: EdgeAttr.hasTraffic, op: '=', val: undefined }).length;
      expect(numEdges).toBeGreaterThan(0);
      if (action === 'appear') {
        expect(numIdleEdges).toBeGreaterThanOrEqual(0);
      } else {
        expect(numIdleEdges).toBe(0);
      }
    });
  }

  async expectIdleNodes(action: 'appear' | 'do not appear'): Promise<void> {
    await this.expectDisplayOptionChecked('filterIdleNodes', action === 'appear');
    await expectGraphTopology(this.page, ({ nodes }) => {
      const nodeElems = nodes.map(n => ({ data: n.data }));
      const numNodes = select(nodeElems, { prop: NodeAttr.isIdle, op: 'truthy' }).length;
      if (action === 'appear') {
        expect(numNodes).toBeGreaterThan(0);
      } else {
        expect(numNodes).toBe(0);
      }
    });
  }

  async expectRanks(action: 'appear' | 'do not appear'): Promise<void> {
    await this.expectDisplayOptionChecked('rank', action === 'appear');
    await expectGraphTopology(this.page, ({ nodes }) => {
      const nodeElems = nodes.map(n => ({ data: n.data }));
      const numNodes = select(nodeElems, { prop: NodeAttr.rank, op: '>', val: '0' }).length;
      if (action === 'appear') {
        expect(numNodes).toBeGreaterThan(0);
      } else {
        expect(numNodes).toBe(0);
      }
    });
  }

  async expectNoServiceNodes(): Promise<void> {
    await this.expectDisplayOptionChecked('filterServiceNodes', false);
    await expectGraphTopology(this.page, ({ nodes }) => {
      const nodeElems = nodes.map(n => ({ data: n.data }));
      const count = selectAnd(nodeElems, [
        { prop: NodeAttr.nodeType, op: '=', val: 'service' },
        { prop: NodeAttr.isOutside, op: '=', val: undefined }
      ]).length;
      expect(count).toBe(0);
    });
  }

  async expectSecurity(action: 'appears' | 'does not appear'): Promise<void> {
    await this.expectDisplayOptionChecked('filterSecurity', action === 'appears');
    await expectGraphTopology(this.page, ({ edges }) => {
      const edgeElems = edges.map(e => ({ data: e.data }));
      const numEdges = select(edgeElems, { prop: EdgeAttr.isMTLS, op: '>', val: 0 }).length;
      if (action === 'appears') {
        expect(numEdges).toBeGreaterThan(0);
      } else {
        expect(numEdges).toBe(0);
      }
    });
  }

  async expectLockIconFontLoaded(): Promise<void> {
    const textEl = this.page.locator('g.pf-topology__edge__tag text').first();
    await expect(textEl).toBeVisible({ timeout: 10_000 });
    const fontFamily = await textEl.evaluate(el => window.getComputedStyle(el).fontFamily);
    const iconFont = fontFamily
      .split(',')
      .map(f => f.trim().replace(/['"]/g, ''))
      .find(f => f.includes('pficon'));
    expect(iconFont).toBeTruthy();
    const fontReady = await this.page.evaluate(font => document.fonts.check(`1rem ${font}`), iconFont!);
    expect(fontReady).toBe(true);
  }

  async expectDisplayClientOption(optionName: string, action: string): Promise<void> {
    const optionId = DISPLAY_OPTION_IDS[optionName.toLowerCase()] ?? optionName;
    const appears = action.includes('appear');
    await this.expectDisplayOptionChecked(optionId, appears);
    await expectGraphTopology(this.page, ({ nodes, edges }) => {
      expect(edges.length).toBeGreaterThan(0);
      expect(nodes.length).toBeGreaterThan(0);
    });
  }

  async resetFactoryDefault(): Promise<void> {
    await this.page.locator('button#graph-factory-reset').click();
    await expect(this.page.locator('#loading_kiali_spinner')).toHaveCount(0);
  }

  async expectDisplayOptionState(
    optionLabel: string,
    checkedState: 'be checked' | 'not be checked',
    enabledState: 'enabled' | 'disabled'
  ): Promise<void> {
    const optionId =
      optionLabel === 'operation nodes'
        ? 'filterOperationNodes'
        : optionLabel === 'service nodes'
          ? 'filterServiceNodes'
          : optionLabel;
    const input = this.page.locator('#graph-display-menu').locator(`input#${optionId}`);
    if (checkedState === 'be checked') {
      await expect(input).toBeChecked();
    } else {
      await expect(input).not.toBeChecked();
    }
    if (enabledState === 'enabled') {
      await expect(input).toBeEnabled();
    } else {
      await expect(input).toBeDisabled();
    }
  }

  async selectGraphType(graphType: string): Promise<void> {
    await this.page.locator('button#graph_type_dropdown-toggle').click();
    await this.page.locator(`div#graph_type_dropdown button[id="${graphType}"]`).click();
    await expect(this.page.locator('#loading_kiali_spinner')).toHaveCount(0);
  }

  async expectSingleClusterBoxForBookinfo(): Promise<void> {
    await expectGraphTopology(this.page, ({ nodes }) => {
      const nodeElems = nodes.map(n => ({ data: n.data }));
      expect(select(nodeElems, { prop: NodeAttr.isBox, op: '=', val: 'cluster' }).length).toBe(0);
      expect(
        selectAnd(nodeElems, [
          { prop: NodeAttr.isBox, op: '=', val: 'namespace' },
          { prop: NodeAttr.namespace, op: '=', val: 'bookinfo' }
        ]).length
      ).toBe(1);
    });
  }

  async openTrafficMenu(): Promise<void> {
    const button = this.page.locator('button#graph-traffic-dropdown');
    await expect(button).toBeEnabled();
    const expanded = await button.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await button.click();
    }
  }

  async closeTrafficMenu(): Promise<void> {
    const button = this.page.locator('button#graph-traffic-dropdown');
    const expanded = await button.getAttribute('aria-expanded');
    if (expanded === 'true') {
      await button.click();
    }
  }

  async expectTrafficMenuVisible(): Promise<void> {
    await expect(this.page.locator('button#graph-traffic-dropdown')).toHaveAttribute('aria-expanded', 'true');
    await expect(this.page.locator('#graph-traffic-menu')).toBeVisible();
  }

  async expectTrafficMenuHidden(): Promise<void> {
    await expect(this.page.locator('button#graph-traffic-dropdown')).toHaveAttribute('aria-expanded', 'false');
  }

  async disableAllTraffic(): Promise<void> {
    const menu = this.page.locator('#graph-traffic-menu');
    await menu.locator('input#grpc').uncheck();
    await expect(this.page.locator('#loading_kiali_spinner')).toHaveCount(0);
    await menu.locator('input#http').uncheck();
    await expect(this.page.locator('#loading_kiali_spinner')).toHaveCount(0);
    await menu.locator('input#tcp').uncheck();
    await expect(this.page.locator('#loading_kiali_spinner')).toHaveCount(0);
  }

  async setTrafficOption(option: string, enabled: boolean): Promise<void> {
    const input = this.page.locator('#graph-traffic-menu').locator(`input#${option}`);
    if (enabled) {
      await input.check();
    } else {
      await input.uncheck();
    }
    await expect(this.page.locator('#loading_kiali_spinner')).toHaveCount(0);
  }

  async expectTrafficVisible(protocol: string): Promise<void> {
    await expectGraphTopology(this.page, ({ edges }) => {
      const edgeElems = edges.map(e => ({ data: e.data }));
      expect(select(edgeElems, { prop: protocol, op: '>', val: 0 }).length).toBeGreaterThan(0);
    });
  }

  async expectNoTraffic(): Promise<void> {
    await expect(this.page.locator('#empty-graph')).toBeVisible();
  }

  async expectTrafficProtocol(protocol: string, visible: boolean): Promise<void> {
    await expectGraphTopology(this.page, ({ edges }) => {
      const edgeElems = edges.map(e => ({ data: e.data }));
      const count = select(edgeElems, { prop: 'protocol', op: '=', val: protocol }).length;
      if (visible) {
        expect(count).toBeGreaterThan(0);
      } else {
        expect(count).toBe(0);
      }
    });
  }

  async clickGraphTour(): Promise<void> {
    await this.page.locator('button#graph-tour').click();
  }

  async closeGraphTour(): Promise<void> {
    await this.page.locator('div[role="dialog"]').getByRole('button', { name: 'Close' }).click();
  }

  async expectGraphTourVisible(): Promise<void> {
    await expect(this.page.locator('.pf-v6-c-popover').getByText('Shortcuts')).toBeAttached();
  }

  async expectGraphTourHidden(): Promise<void> {
    await expect(this.page.locator('.pf-v6-c-popover')).toHaveCount(0);
  }

  async clickDurationMenu(): Promise<void> {
    await this.page.locator('button#time_range_duration-toggle').click();
  }

  async expectDurationMenuVisible(): Promise<void> {
    await expect(this.page.locator('button#time_range_duration-toggle')).toHaveAttribute('aria-expanded', 'true');
  }

  async expectDurationMenuHidden(): Promise<void> {
    await expect(this.page.locator('button#time_range_duration-toggle')).toHaveAttribute('aria-expanded', 'false');
  }

  async selectGraphDuration(duration: string): Promise<void> {
    await this.page.locator('button#time_range_duration-toggle').click();
    await this.page.locator(`button[id="${duration}"]`).click();
    await expect(this.page.locator('#loading_kiali_spinner')).toHaveCount(0);
  }

  async expectSelectedDuration(label: string): Promise<void> {
    await expect(this.page.locator('button#time_range_duration-toggle')).toContainText(label);
  }

  async clickRefreshMenu(): Promise<void> {
    await this.page.locator('button#time_range_refresh-toggle').click();
  }

  async expectRefreshMenuVisible(): Promise<void> {
    await expect(this.page.locator('button#time_range_refresh-toggle')).toHaveAttribute('aria-expanded', 'true');
  }

  async expectRefreshMenuHidden(): Promise<void> {
    await expect(this.page.locator('button#time_range_refresh-toggle')).toHaveAttribute('aria-expanded', 'false');
  }

  async selectGraphRefresh(refresh: string): Promise<void> {
    await this.page.locator('button#time_range_refresh-toggle').click();
    await this.page.locator(`button[id="${refresh}"]`).click();
    await expect(this.page.locator('#loading_kiali_spinner')).toHaveCount(0);
  }

  async expectSelectedRefresh(label: string): Promise<void> {
    await expect(this.page.locator('button#time_range_refresh-toggle')).toContainText(label);
  }

  async expectGraphType(graphType: string): Promise<void> {
    await expectGraphTopology(this.page, ({ nodes }) => {
      const nodeElems = nodes.map(n => ({ data: n.data }));
      if (graphType === 'app') {
        expect(select(nodeElems, { prop: NodeAttr.isBox, op: '=', val: 'app' }).length).toBeGreaterThan(0);
      } else if (graphType === 'service') {
        expect(select(nodeElems, { prop: NodeAttr.nodeType, op: '=', val: 'service' }).length).toBeGreaterThan(0);
      } else if (graphType === 'versionedApp') {
        expect(select(nodeElems, { prop: NodeAttr.nodeType, op: '=', val: 'app' }).length).toBeGreaterThan(0);
      } else if (graphType === 'workload') {
        expect(select(nodeElems, { prop: NodeAttr.nodeType, op: '=', val: 'workload' }).length).toBeGreaterThan(0);
      }
    });
  }

  async expectNamespaceDropdownSorted(): Promise<void> {
    const labels = await this.page.locator('[data-test="namespace-dropdown"] label').allTextContents();
    const sorted = [...labels].sort((a, b) => a.localeCompare(b));
    expect(labels).toEqual(sorted);
  }

  async openContextMenuForService(serviceName: string): Promise<void> {
    const topology = await readGraphTopology(this.page);
    const node = topology.nodes.find(n => n.data.nodeType === 'service' && n.data.service === serviceName);
    expect(node).toBeTruthy();
    await this.page.locator(`[data-id="${node!.id}"]`).click({ button: 'right' });
    await expect(this.page.locator('.pf-topology-context-menu__c-dropdown__menu')).toBeVisible();
  }

  async clickContextMenuItem(menuKey: string): Promise<void> {
    await this.page.locator('.pf-topology-context-menu__c-dropdown__menu').locator(`[data-test="${menuKey}"]`).click();
  }

  async expectWizardVisible(wizardKey: string): Promise<void> {
    await expect(this.page.locator(`[data-test="${wizardKey}_modal"]`)).toBeAttached();
  }

  async clickContextMenuLink(linkText: string): Promise<void> {
    await this.page
      .locator('.pf-topology-context-menu__c-dropdown__menu')
      .getByRole('button', { name: linkText })
      .click();
  }

  async expectUrlWithoutClusterParam(): Promise<void> {
    await expect(this.page).not.toHaveURL(/clusterName=/);
  }

  async expectContextMenuItemDisabledInViewOnly(menuKey: string): Promise<void> {
    const item = this.page.locator('.pf-topology-context-menu__c-dropdown__menu').locator(`[data-test="${menuKey}"]`);
    await expect(item).toHaveClass(/pf-m-disabled/);
    await expect(item.locator('button')).toBeDisabled();
  }

  async expectContextMenuItemEnabledInViewOnly(menuKey: string): Promise<void> {
    const item = this.page.locator('.pf-topology-context-menu__c-dropdown__menu').locator(`[data-test="${menuKey}"]`);
    await expect(item).not.toHaveClass(/pf-m-disabled/);
    await expect(item.locator('button')).toBeEnabled();
  }

  async expectDeleteTrafficRoutingModal(): Promise<void> {
    await expect(this.page.locator('[data-test="delete-traffic-routing-modal"]')).toBeAttached();
  }

  async clickGraphNode(name: string, nodeType: string): Promise<void> {
    const topology = await readGraphTopology(this.page);
    const prop = nodeType === 'service' ? NodeAttr.service : NodeAttr.app;
    const node = topology.nodes.find(n => n.data.nodeType === nodeType && n.data[prop] === name);
    expect(node).toBeTruthy();
    await this.page.locator(`[data-id="${node!.id}"]`).click();
  }

  async openSidePanelKebab(): Promise<void> {
    await this.page.locator('#summary-node-kebab').click();
  }

  async clickSidePanelKebabItem(menuKey: string): Promise<void> {
    await this.page.locator(`#summary-node-actions [data-test="${menuKey}"]`).click();
  }

  async pressReplay(): Promise<void> {
    await this.getBySel('graph-replay-button').click();
  }

  async expectReplayCloseVisible(): Promise<void> {
    await expect(this.getBySel('graph-replay-close-button')).toBeVisible();
  }

  async pressReplayPlay(): Promise<void> {
    await this.getBySel('graph-replay-play-button').click();
  }

  async expectReplaySliderVisible(): Promise<void> {
    await expect(this.page.locator('#replay-slider')).toBeVisible();
  }

  async pressReplaySpeed(speed: string): Promise<void> {
    await this.getBySel(`speed-${speed}`).click();
  }

  async pressReplayPause(): Promise<void> {
    await this.getBySel('graph-replay-pause-button').click();
  }

  async pressReplayClose(): Promise<void> {
    await this.getBySel('graph-replay-close-button').click();
  }

  async expectReplaySliderHidden(): Promise<void> {
    await expect(this.page.locator('#replay-slider')).toHaveCount(0);
  }

  async fillFind(expression: string): Promise<void> {
    await this.page.locator('#graph_find').fill(expression);
    await this.page.locator('#graph_find').press('Enter');
    await expect(this.page.locator('#graph_find')).toHaveValue(expression.replace('{enter}', ''));
  }

  async fillHide(expression: string): Promise<void> {
    await this.page.locator('#graph_hide').fill(expression);
    await this.page.locator('#graph_hide').press('Enter');
  }

  async clearFindHide(): Promise<void> {
    await this.page.locator('#graph_hide').clear();
    await this.page.locator('#graph_find').clear();
  }

  async expectNoHighlightedNodes(): Promise<void> {
    await expectGraphTopology(this.page, ({ nodes }) => {
      const highlighted = nodes.filter(n => n.data.isFind);
      expect(highlighted.length).toBe(0);
    });
  }

  async expectUnhealthyWorkloadsHighlighted(): Promise<void> {
    const expected = [
      { app: 'w-server', version: 'v1', namespace: 'alpha' },
      { app: 'w-server', version: undefined, namespace: 'alpha' },
      { app: 'y-server', version: 'v1', namespace: 'alpha' },
      { app: 'y-server', version: undefined, namespace: 'alpha' }
    ];
    await expectGraphTopology(this.page, ({ nodes }) => {
      const unhealthy = nodes
        .filter(n => n.data.isFind)
        .map(n => ({
          app: n.data.app,
          version: n.data.version,
          namespace: n.data.namespace
        }));
      for (const item of expected) {
        expect(unhealthy).toEqual(expect.arrayContaining([expect.objectContaining(item)]));
      }
    });
  }

  async expectNoUnhealthyVisibleWorkloads(): Promise<void> {
    await expectGraphTopology(this.page, ({ nodes }) => {
      const visible = nodes.filter(n => n.visible);
      const ok = visible.every(n => n.data.healthStatus !== 'Failure' || n.data.nodeType === 'box');
      expect(ok).toBe(true);
    });
  }

  async openFindPresets(): Promise<void> {
    await this.getBySel('find-options-dropdown').click();
    await expect(this.page.locator('#graph-find-presets')).toContainText('Find: unhealthy nodes');
  }

  async selectFindPreset(option: string): Promise<void> {
    await this.page.locator('#graph-find-presets').getByText(option).click();
    await expect(this.page.locator('#graph_find')).not.toHaveValue('');
  }

  async openHidePresets(): Promise<void> {
    await this.getBySel('hide-options-dropdown').click();
    await expect(this.page.locator('#graph-hide-presets')).toContainText('Hide: healthy nodes');
  }

  async selectHidePreset(option: string): Promise<void> {
    await this.page.locator('#graph-hide-presets').getByText(option).click();
    await expect(this.page.locator('#graph_hide')).not.toHaveValue('');
  }

  async expectNoHealthyVisibleWorkloads(): Promise<void> {
    await expectGraphTopology(this.page, ({ nodes }) => {
      const visible = nodes.filter(n => n.visible);
      const ok = visible.every(n => n.data.healthStatus !== 'Healthy' || n.data.nodeType === 'box');
      expect(ok).toBe(true);
    });
  }

  async openFindHideHelp(): Promise<void> {
    await this.page.locator('#graph-findhide-help').click();
  }

  async expectFindHideHelpSections(...sections: string[]): Promise<void> {
    for (const section of sections) {
      await expect(this.page.getByRole('heading', { name: section })).toBeVisible();
    }
  }

  async expectFindError(message: string): Promise<void> {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  async clickToolbarButton(id: string): Promise<void> {
    await this.page.locator(`button#${id}`).click();
  }

  async expectToolbarButtonEnabled(id: string): Promise<void> {
    await expect(this.page.locator(`button#${id}`)).toBeEnabled();
  }

  async expectToolbarButtonActive(id: string, active: boolean): Promise<void> {
    const icon = this.page.locator(`button#${id} .pf-v6-c-icon__content`);
    if (active) {
      await expect(icon).toHaveClass(/pf-m-custom/);
    } else {
      await expect(icon).not.toHaveClass(/pf-m-custom/);
    }
  }

  async prepareToolbarButton(id: string, active: boolean): Promise<void> {
    const icon = this.page.locator(`button#${id} .pf-v6-c-icon__content`);
    const className = await icon.getAttribute('class');
    const isActive = className?.includes('pf-m-custom') ?? false;
    if (isActive !== active) {
      await this.clickToolbarButton(id);
    }
  }

  async expectLegendVisible(): Promise<void> {
    await expect(this.page.locator('[data-test="graph-legend"]')).toBeVisible();
  }

  async expectLegendHidden(): Promise<void> {
    await expect(this.page.locator('[data-test="graph-legend"]')).toHaveCount(0);
  }

  async closeLegendWithCross(): Promise<void> {
    await this.page.locator('#legend_close').click();
  }

  async expectReadOnlyWizardYaml(wizardKey: string): Promise<void> {
    const title = `View ${WIZARD_TITLES[wizardKey]}`;
    const modal = this.page.locator('.pf-v6-c-modal-box').last();
    await expect(modal).toContainText(title);
    await expect(modal.getByText('Copy')).toBeVisible();
    await expect(modal.getByText('Download')).toBeVisible();
    await expect(modal.locator('.monaco-editor')).toBeAttached();
    await expect(modal.getByRole('button', { name: 'Close' })).toBeVisible();
  }

  async clickGraphEdge(fromName: string, fromType: string, toName: string, toType: string): Promise<void> {
    const topology = await readGraphTopology(this.page);
    const fromProp = fromType === 'app' ? 'app' : 'service';
    const toProp = toType === 'app' ? 'app' : 'service';
    const fromNode = topology.nodes.find(n => n.data.nodeType === fromType && n.data[fromProp] === fromName);
    const toNode = topology.nodes.find(n => n.data.nodeType === toType && n.data[toProp] === toName);
    expect(fromNode).toBeTruthy();
    expect(toNode).toBeTruthy();
    const edge = topology.edges.find(e => e.data.source === fromNode!.id && e.data.target === toNode!.id);
    expect(edge).toBeTruthy();
    await this.page.locator(`[data-id="${edge!.id}"]`).click();
  }

  async expectSummaryPanelContains(text: string): Promise<void> {
    await expect(this.page.locator('#graph-side-panel')).toContainText(text);
  }
}

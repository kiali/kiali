import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoConsolePage } from '../utils/navigation';
import { selectMeshNodeByLabel } from '../utils/meshTopology';

type MeshGraphNode = {
  data?: {
    healthData?: string;
    id?: string;
    infraName?: string;
    infraType?: string;
  };
};

type MeshGraphEdge = {
  data?: {
    source?: string;
    target?: string;
  };
};

type MeshGraphResponse = {
  elements?: {
    nodes?: MeshGraphNode[];
    edges?: MeshGraphEdge[];
  };
};

export class MeshPage extends BasePage {
  async open(): Promise<void> {
    await gotoConsolePage(this.page, 'mesh');
  }

  /**
   * Assert kiali infra node has the expected number of edges to istiod nodes.
   * Uses /api/mesh/graph (more stable than React fiber selectors).
   */
  async expectKialiConnectedToIstiod(edgeCount = 1): Promise<void> {
    await this.waitForLoad();

    const response = await this.page.request.get('/api/mesh/graph');
    expect(response.ok(), `Expected /api/mesh/graph OK, got ${response.status()}`).toBeTruthy();
    const body = (await response.json()) as MeshGraphResponse;
    const nodes = body.elements?.nodes ?? [];
    const edges = body.elements?.edges ?? [];

    const kiali = nodes.find(n => n.data?.infraType === 'kiali');
    expect(kiali?.data?.id, 'Expected a kiali infra node in mesh graph').toBeTruthy();

    const istiodIds = new Set(
      nodes
        .filter(n => n.data?.infraType === 'istiod')
        .map(n => n.data?.id)
        .filter(Boolean) as string[]
    );
    expect(istiodIds.size, 'Expected at least one istiod node').toBeGreaterThan(0);

    const kialiId = kiali!.data!.id!;
    const connected = edges.filter(e => {
      const { source, target } = e.data ?? {};
      if (!source || !target) {
        return false;
      }
      return (source === kialiId && istiodIds.has(target)) || (target === kialiId && istiodIds.has(source));
    });

    expect(connected.length, `Expected ${edgeCount} kiali↔istiod edge(s), got ${connected.length}`).toBe(edgeCount);
  }

  async selectMeshNodeByLabel(label: string): Promise<void> {
    await this.waitForLoad();
    await selectMeshNodeByLabel(this.page, label);
    await this.waitForLoad();
  }

  async expectNodeSidePanel(name: string): Promise<void> {
    await this.waitForLoad();
    await expect(this.page.locator('#target-panel-node')).toBeVisible();
    await expect(this.page.locator('#target-panel-node')).toContainText(name);
  }

  async usesLocalGrafanaPortForward(): Promise<boolean> {
    const panel = this.page.locator('#target-panel-node');
    await expect(panel).toBeVisible();
    const text = await panel.textContent();
    return Boolean(text?.includes('localhost:') || text?.includes('127.0.0.1'));
  }

  async waitForInfraHealth(infraName: string, predicate: (health: string) => boolean): Promise<void> {
    await expect(async () => {
      const response = await this.page.request.get('/api/mesh/graph');
      expect(response.ok()).toBeTruthy();
      const body = (await response.json()) as MeshGraphResponse;
      const node = (body.elements?.nodes ?? []).find(n => n.data?.infraName?.toLowerCase() === infraName.toLowerCase());
      const health = node?.data?.healthData;
      expect(health, `Expected health data for ${infraName}`).toBeTruthy();
      expect(predicate(health!)).toBe(true);
    }).toPass({ intervals: [3_000], timeout: 60_000 });
  }

  async expectSidePanelIcon(type: string): Promise<void> {
    const panel = this.page.locator('#target-panel-node');
    await expect(async () => {
      await expect(panel.getByTestId(`icon-${type}-validation`)).toBeVisible();
    }).toPass({ intervals: [3_000], timeout: 60_000 });
  }

  async expectNoSidePanelIcon(type: string): Promise<void> {
    await expect(this.page.locator('#target-panel-node').getByTestId(`icon-${type}-validation`)).toHaveCount(0);
  }

  async expectSidePanelContains(text: string): Promise<void> {
    await expect(this.page.locator('#target-panel-node')).toContainText(text);
  }

  async expectConfigTabs(tabs: string): Promise<void> {
    for (const tab of tabs.split(',')) {
      await expect(this.getBySel(`config-tab-${tab.trim()}`)).toBeVisible();
    }
  }

  async expectConfigTabContains(tab: string, text: string): Promise<void> {
    await this.getBySel(`config-tab-${tab}`).click();
    await expect(this.getBySel(`${tab}-config-editor`)).toContainText(text);
  }

  async expectConfigTabNotContains(tab: string, text: string): Promise<void> {
    await this.getBySel(`config-tab-${tab}`).click();
    await expect(this.getBySel(`${tab}-config-editor`)).not.toContainText(text);
  }

  async refreshPage(): Promise<void> {
    await this.getBySel('refresh-button').click();
    await this.waitForLoad();
  }

  async expectControlPlaneSidePanel(): Promise<void> {
    const maxTries = 15;
    for (let tries = 1; tries <= maxTries; tries++) {
      const response = await this.page.request.get('/api/namespaces/istio-system/controlplanes/istiod/metrics');
      if (response.ok()) {
        const body = await response.json();
        if (body.process_resident_memory_bytes != null) {
          break;
        }
      }
      if (tries === maxTries) {
        throw new Error('Timed out waiting for istiod memory metrics');
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    await this.refreshPage();
    const panel = this.page.locator('#target-panel-control-plane');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('istiod');
    await expect(panel).toContainText('Outbound policy');
    await expect(panel.getByTestId('memory-chart')).toBeVisible();
    await expect(panel.getByTestId('cpu-chart')).toBeVisible();
    await expect(panel.getByTestId('control-plane-certificate')).toBeVisible();
    await expect(panel.getByTestId('label-TLS')).toContainText('TLSV1_2');
  }
}

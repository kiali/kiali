import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoConsolePage } from '../utils/navigation';
import { kialiUrl } from '../utils/kialiUrl';
import { selectClusterMeshNode, selectMeshNodeByLabel, selectTracingMeshNode } from '../utils/meshTopology';
import { waitForLoadingComplete } from '../utils/transition';

type MeshGraphNode = {
  data?: {
    cluster?: string;
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
    await this.expectInfraConnectedTo('kiali', 'istiod', edgeCount);
  }

  /** Assert count of mesh infra nodes of a given type on a named cluster. */
  async expectInfraNodeCount(infraType: string, cluster: string, count: number): Promise<void> {
    await this.waitForLoad();

    await expect(async () => {
      const { nodes } = await this.fetchMeshGraph();
      const matched = nodes.filter(n => n.data?.infraType === infraType && n.data?.cluster === cluster);
      expect(
        matched.length,
        `Expected ${count} "${infraType}" node(s) on cluster "${cluster}", got ${matched.length}`
      ).toBe(count);
    }).toPass({ intervals: [2_000], timeout: 60_000 });
  }

  /** Assert a source infra node has the expected number of edges to dest infra nodes. */
  async expectInfraConnectedTo(sourceInfraType: string, destInfraType: string, edgeCount: number): Promise<void> {
    await this.waitForLoad();

    await expect(async () => {
      const { nodes, edges } = await this.fetchMeshGraph();

      const source = nodes.find(n => n.data?.infraType === sourceInfraType);
      expect(source?.data?.id, `Expected a "${sourceInfraType}" infra node in mesh graph`).toBeTruthy();

      const destIds = new Set(
        nodes
          .filter(n => n.data?.infraType === destInfraType)
          .map(n => n.data?.id)
          .filter(Boolean) as string[]
      );
      expect(destIds.size, `Expected at least one "${destInfraType}" node`).toBeGreaterThan(0);

      const sourceId = source!.data!.id!;
      const connected = edges.filter(e => {
        const { source: edgeSource, target } = e.data ?? {};
        if (!edgeSource || !target) {
          return false;
        }
        return (edgeSource === sourceId && destIds.has(target)) || (target === sourceId && destIds.has(edgeSource));
      });

      expect(
        connected.length,
        `Expected ${edgeCount} ${sourceInfraType}↔${destInfraType} edge(s), got ${connected.length}`
      ).toBe(edgeCount);
    }).toPass({ intervals: [2_000], timeout: 60_000 });
  }

  private async fetchMeshGraph(): Promise<{ edges: MeshGraphEdge[]; nodes: MeshGraphNode[] }> {
    const response = await this.page.request.get(kialiUrl('/api/mesh/graph'));
    expect(response.ok(), `Expected /api/mesh/graph OK, got ${response.status()}`).toBeTruthy();
    const body = (await response.json()) as MeshGraphResponse;
    return {
      edges: body.elements?.edges ?? [],
      nodes: body.elements?.nodes ?? []
    };
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

  /** True when Kiali reaches Grafana via local port-forward (KinD CI), not an in-cluster route (Jenkins/OSSM). */
  async usesLocalGrafanaPortForward(): Promise<boolean> {
    const panel = this.page.locator('#target-panel-node');
    await expect(panel).toBeVisible();
    const text = await panel.textContent();
    return Boolean(text?.includes('localhost:') || text?.includes('127.0.0.1'));
  }

  async waitForInfraHealth(infraName: string, predicate: (health: string) => boolean): Promise<void> {
    await expect(async () => {
      const response = await this.page.request.get(kialiUrl('/api/mesh/graph'));
      expect(response.ok()).toBeTruthy();
      const body = (await response.json()) as MeshGraphResponse;
      const node = (body.elements?.nodes ?? []).find(n => n.data?.infraName?.toLowerCase() === infraName.toLowerCase());
      const health = node?.data?.healthData;
      expect(health, `Expected health data for ${infraName}`).toBeTruthy();
      expect(predicate(health!)).toBe(true);
    }).toPass({ intervals: [3_000], timeout: 60_000 });
  }

  /**
   * Poll /api/mesh/graph for health, then refresh the mesh page so cytoscape node data
   * (and the side-panel health icon) match the API before selecting the node.
   */
  async syncInfraHealthToUi(infraName: string, predicate: (health: string) => boolean): Promise<void> {
    await this.waitForInfraHealth(infraName, predicate);
    await this.refreshPage();
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
    await expect(async () => {
      const response = await this.page.request.get(
        kialiUrl('/api/namespaces/istio-system/controlplanes/istiod/metrics')
      );
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.process_resident_memory_bytes).toBeTruthy();
      expect(body.process_cpu_seconds_total).toBeTruthy();
    }).toPass({ intervals: [3_000], timeout: 120_000 });

    await expect(async () => {
      await this.refreshPage();
      await this.selectMeshNodeByLabel('istiod');
      const panel = this.page.locator('#target-panel-control-plane');
      await expect(panel).toBeVisible();
      await expect(panel).toContainText('istiod');
      await expect(panel).toContainText('Outbound policy');
      await expect(panel.getByTestId('memory-chart')).toBeVisible();
      await expect(panel.getByTestId('cpu-chart')).toBeVisible();
      await expect(panel.getByTestId('control-plane-certificate')).toBeVisible();
      await expect(panel.getByTestId('label-TLS')).toContainText('TLSV1_2');
    }).toPass({ intervals: [3_000], timeout: 120_000 });
  }

  async openMeshTour(): Promise<void> {
    await this.page.locator('button#mesh-tour').click();
  }

  async closeMeshTour(): Promise<void> {
    await this.page.locator('div[role="dialog"]').getByRole('button', { name: 'Close' }).click();
  }

  async expectMeshTourVisible(visible: boolean): Promise<void> {
    const popover = this.page.locator('.pf-v6-c-popover').filter({ hasText: 'Shortcuts' });
    if (visible) {
      await expect(popover).toBeVisible();
    } else {
      await expect(popover).toHaveCount(0);
    }
  }

  async selectClusterNode(): Promise<void> {
    await this.waitForLoad();
    await selectClusterMeshNode(this.page);
    await this.waitForLoad();
  }

  async selectTracingNode(): Promise<void> {
    await this.waitForLoad();
    await selectTracingMeshNode(this.page);
    await this.waitForLoad();
  }

  async expectMeshSidePanel(): Promise<void> {
    await expect(this.page.locator('#target-panel-mesh')).toBeVisible();
    const response = await this.page.request.get(kialiUrl('/api/mesh/graph'));
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const meshNames = body.meshNames as string[];
    expect(meshNames?.length).toBeGreaterThan(0);
    for (const meshName of meshNames) {
      await expect(this.page.locator('#target-panel-mesh')).toContainText(`Mesh: ${meshName}`);
    }
  }

  async expectExpectedMeshInfra(): Promise<void> {
    const response = await this.page.request.get(kialiUrl('/api/mesh/graph'));
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const nodes = body.elements?.nodes ?? [];
    const nodeNames = nodes.map((n: { data?: { infraName?: string; infraType?: string } }) =>
      (n.data?.infraName ?? n.data?.infraType ?? '').toLowerCase()
    );
    expect(nodeNames.some((n: string) => n.includes('data plane') || n === 'dataplane')).toBeTruthy();
    expect(nodeNames.some((n: string) => n.includes('grafana'))).toBeTruthy();
    expect(nodeNames.some((n: string) => n.startsWith('istiod') || n.includes('istiod'))).toBeTruthy();
    expect(nodeNames.some((n: string) => n.includes('jaeger') || n.includes('tempo'))).toBeTruthy();
    expect(nodeNames.some((n: string) => n.includes('kiali'))).toBeTruthy();
    expect(nodeNames.some((n: string) => n.includes('prometheus'))).toBeTruthy();
  }

  async expectDataPlaneSidePanel(): Promise<void> {
    await expect(this.page.locator('#target-panel-data-plane')).toBeVisible();
    await expect(this.page.locator('#target-panel-data-plane')).toContainText('Data Plane');
  }

  async expandDataPlaneNamespace(): Promise<void> {
    const panel = this.page.locator('#target-panel-data-plane');
    await panel.locator('button[id^="ns-bookinfo"]').first().click();
    await waitForLoadingComplete(this.page);
  }

  async expectConfigValidationInfo(): Promise<void> {
    const panel = this.page.locator('#target-panel-data-plane');
    await expect(panel.getByText('Istio config', { exact: true })).toBeVisible();
    await expect(panel.getByText('Istio config').locator('..')).not.toContainText('N/A');
  }

  async expectClusterSidePanel(): Promise<void> {
    await expect(this.page.locator('#target-panel-cluster')).toBeVisible();
  }

  async expectNamespaceSidePanel(name: string): Promise<void> {
    await expect(this.page.locator('#target-panel-namespace')).toBeVisible();
    await expect(this.page.locator('#target-panel-namespace')).toContainText(name);
  }

  async expectMeshBodyNotContains(text: string): Promise<void> {
    await expect(this.page.locator('#target-panel-mesh-body')).not.toContainText(text);
  }

  async expectTracingSidePanel(): Promise<void> {
    await expect(this.page.locator('#target-panel-node')).toContainText(/jaeger|Jaeger|tempo|Tempo/);
  }

  async toggleMeshDisplayMenu(open: boolean): Promise<void> {
    const button = this.page.locator('button#display-settings');
    if (open) {
      await button.click();
      await expect(this.page.locator('div#mesh-display-menu')).toBeVisible();
    } else {
      await button.click();
      await expect(this.page.locator('div#mesh-display-menu')).toHaveCount(0);
    }
  }

  async setMeshDisplayOption(option: string, enabled: boolean): Promise<void> {
    const optionId = option.toLowerCase() === 'gateways' ? 'filterGateways' : option;
    const input = this.page.locator(`div#mesh-display-menu input#${optionId}`);
    if (enabled) {
      await input.check();
    } else {
      await input.uncheck();
    }
  }

  async openTraceConfigurationModal(): Promise<void> {
    const diagnosePromise = this.page
      .waitForResponse(response => response.url().includes('/api/tracing/diagnose') && response.ok())
      .catch(() => undefined);
    await this.page.getByRole('button', { name: 'Configuration Tester' }).click();
    await expect(this.page.locator('.pf-v6-c-modal-box')).toBeVisible();
    await diagnosePromise;
  }

  async expectTraceConfigurationModal(): Promise<void> {
    await expect(this.page.locator('.pf-v6-c-modal-box')).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Configuration Tester' })).toBeVisible();
  }

  async expectTraceConfigTabs(): Promise<void> {
    await expect(this.page.getByRole('tab', { name: 'Discovery' })).toBeVisible();
    await expect(this.page.getByRole('tab', { name: 'Tester' })).toBeVisible();
  }

  async expectTraceConfigFooterActions(): Promise<void> {
    await expect(this.page.locator('.pf-v6-c-modal-box__footer')).toBeVisible();
    await expect(this.page.locator('.pf-v6-c-modal-box__footer').getByRole('button', { name: 'Close' })).toBeVisible();
  }

  async clickRediscover(): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      response => response.url().includes('/api/tracing/diagnose') && response.ok()
    );
    await this.page.locator('.pf-v6-c-modal-box').getByRole('button', { name: 'Rediscover' }).click();
    await responsePromise;
    await expect(this.page.locator('#discover-spinner')).toHaveCount(0);
  }

  async expectDiscoveryInformation(): Promise<void> {
    const discovery = this.page.locator('#discovery-tab-content');
    await expect(this.page.locator('#discover-spinner')).toHaveCount(0);
    await expect(discovery).toContainText('Possible configuration(s) found');
    await expect(discovery.locator('#valid-configurations')).toContainText('Provider:');
    await expect(discovery).toContainText('Logs');
    await expect(discovery.locator('#configuration-logs')).toContainText('Parsed url');
    await expect(discovery.locator('#configuration-logs')).toContainText('Checking open ports');
  }

  async switchToTesterTab(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Tester' }).click();
  }

  async toggleTracingProviderInTester(): Promise<void> {
    await expect(this.getBySel('tracing-config-editor').locator('.monaco-editor')).toBeVisible();
    await this.page.evaluate(() => {
      const win = window as Window & {
        tracingConfigEditor?: {
          getModel: () => { getFullModelRange: () => unknown };
          getValue: () => string;
          executeEdits: (s: string, e: unknown[]) => void;
        };
      };
      const editor = win.tracingConfigEditor;
      if (!editor) {
        throw new Error('Tracing config Monaco editor not found');
      }
      const editorText = editor.getValue();
      let replacer = 'tempo';
      let provider = 'jaeger';
      if (editorText.includes('tempo')) {
        replacer = 'jaeger';
        provider = 'tempo';
      }
      const newText = editorText.replace(`provider: ${provider}`, `provider: ${replacer}`);
      const model = editor.getModel();
      const fullRange = model.getFullModelRange();
      editor.executeEdits('playwright', [{ range: fullRange, text: newText }]);
    });
  }

  async toggleUseGrpcInTester(): Promise<void> {
    await this.page.evaluate(() => {
      const win = window as Window & {
        tracingConfigEditor?: {
          getModel: () => { getFullModelRange: () => unknown };
          getValue: () => string;
          executeEdits: (s: string, e: unknown[]) => void;
        };
      };
      const editor = win.tracingConfigEditor;
      if (!editor) {
        throw new Error('Tracing config Monaco editor not found');
      }
      const editorText = editor.getValue();
      let currentValue: string | null = null;
      let targetValue = 'true';
      if (/useGRPC\s*:\s*true/i.test(editorText)) {
        currentValue = 'true';
        targetValue = 'false';
      } else if (/useGRPC\s*:\s*false/i.test(editorText)) {
        currentValue = 'false';
        targetValue = 'true';
      }
      if (currentValue !== null) {
        const newText = editorText.replace(new RegExp(`(useGRPC\\s*:\\s*)${currentValue}`, 'gi'), `$1${targetValue}`);
        const model = editor.getModel();
        const fullRange = model.getFullModelRange();
        editor.executeEdits('playwright', [{ range: fullRange, text: newText }]);
      }
    });
  }

  async clickTestConfiguration(): Promise<void> {
    await this.getBySel('modal-configuration-tester').getByText('Test Configuration').click();
  }

  async expectTesterResult(result: 'correct' | 'incorrect'): Promise<void> {
    const icon = result === 'incorrect' ? 'icon-error-validation' : 'icon-correct-validation';
    await expect(this.getBySel('modal-configuration-tester').getByTestId(icon)).toBeVisible();
  }
}

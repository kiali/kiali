import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoConsolePage } from '../utils/navigation';

type MeshGraphNode = {
  data?: {
    id?: string;
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
}

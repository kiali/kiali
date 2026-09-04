import type { Page } from '@playwright/test';

/**
 * Select a mesh topology node by label via MeshPageComponent React state.
 * Mirrors Cypress mesh.ts getReact + setSelectedIds pattern.
 */
export async function selectMeshNodeByLabel(page: Page, label: string): Promise<void> {
  await page.evaluate(nodeLabel => {
    const getReactFiber = (el: Element): unknown => {
      if ('_reactRootContainer' in el) {
        const container = (el as { _reactRootContainer?: { _internalRoot?: { current?: unknown }; current?: unknown } })
          ._reactRootContainer;
        return container?._internalRoot?.current ?? container?.current;
      }
      const containerKey = Object.keys(el).find(k => k.startsWith('__reactContainer'));
      if (containerKey) {
        const container = (el as Record<string, unknown>)[containerKey] as {
          stateNode?: { current?: unknown };
        };
        return container?.stateNode?.current ?? container;
      }
      const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
      return fiberKey ? (el as Record<string, unknown>)[fiberKey] : null;
    };

    const getComponentName = (fiber: { type?: unknown }): string => {
      const type = fiber.type as {
        displayName?: string;
        name?: string;
        render?: { displayName?: string; name?: string };
      };
      if (!type) return '';
      if (typeof type === 'string') return type;
      if (typeof type === 'function') {
        return type.displayName || type.name || '';
      }
      if (type.displayName) return type.displayName;
      if (type.name) return type.name;
      if (type.render) {
        return type.render.displayName || type.render.name || '';
      }
      return '';
    };

    const getStateFromFiber = (fiber: { memoizedState?: unknown }): unknown => {
      const memoizedState = fiber.memoizedState as
        { next?: unknown; baseState?: unknown; memoizedState?: unknown } | Record<string, unknown> | null;
      if (!memoizedState) return undefined;
      if (typeof memoizedState === 'object' && memoizedState !== null) {
        if (!('next' in memoizedState) && !('baseState' in memoizedState)) {
          return memoizedState;
        }
        if ('baseState' in memoizedState && memoizedState.baseState !== undefined) {
          return memoizedState.baseState;
        }
      }
      let hook = memoizedState as { next?: unknown; baseState?: unknown; memoizedState?: unknown } | null;
      while (hook) {
        if (hook.memoizedState !== undefined && hook.memoizedState !== null) {
          if (typeof hook.memoizedState !== 'object' || !('next' in (hook.memoizedState as object))) {
            return hook.memoizedState;
          }
        }
        if (hook.baseState !== undefined) {
          return hook.baseState;
        }
        hook = hook.next as typeof hook;
      }
      return undefined;
    };

    type ReactTreeNode = {
      children: ReactTreeNode[];
      name: string;
      state: unknown;
    };

    const buildNodeTree = (fiber: { child?: unknown; sibling?: unknown; type?: unknown }): ReactTreeNode => {
      const name = getComponentName(fiber as { type?: unknown });
      const state = getStateFromFiber(fiber as { memoizedState?: unknown });
      const children: ReactTreeNode[] = [];
      let child = fiber.child as { child?: unknown; sibling?: unknown } | null;
      while (child) {
        children.push(buildNodeTree(child));
        child = child.sibling as typeof child;
      }
      return { name, state, children };
    };

    const findComponentsInTree = (
      tree: ReactTreeNode,
      selector: string,
      stateFilter: Record<string, unknown>
    ): ReactTreeNode[] => {
      const results: ReactTreeNode[] = [];
      const stack: ReactTreeNode[] = [tree];
      while (stack.length) {
        const current = stack.pop()!;
        if (current.name === selector) {
          const state = current.state as Record<string, unknown> | undefined;
          const matches = Object.entries(stateFilter).every(([key, value]) => state?.[key] === value);
          if (matches) {
            results.push(current);
          }
        }
        for (let i = current.children.length - 1; i >= 0; i--) {
          stack.push(current.children[i]);
        }
      }
      return results;
    };

    const rootEl = document.querySelector('#root') ?? document.querySelector('body');
    if (!rootEl) {
      throw new Error('React root element not found');
    }
    const fiber = getReactFiber(rootEl);
    if (!fiber) {
      throw new Error('React fiber root not found');
    }
    const tree = buildNodeTree(fiber as Parameters<typeof buildNodeTree>[0]);
    const results = findComponentsInTree(tree, 'MeshPageComponent', { isReady: true });
    if (results.length !== 1) {
      throw new Error(`MeshPageComponent not ready (found ${results.length})`);
    }

    const state = results[0].state as {
      meshRefs: {
        getController: () => {
          getElements: () => Array<{
            getData: () => Record<string, unknown>;
            getId: () => string;
            getKind: () => string;
            getLabel: () => string;
          }>;
          hasGraph: () => boolean;
        };
        setSelectedIds: (values: string[]) => void;
      };
    };

    const controller = state.meshRefs.getController();
    if (!controller.hasGraph()) {
      throw new Error('Mesh controller has no graph');
    }

    const elements = controller.getElements();
    const nodeKind = 'node';
    const nodes = elements.filter(el => el.getKind?.() === nodeKind);
    const node = nodes.find(n => n.getLabel().toLowerCase() === nodeLabel.toLowerCase());
    if (!node) {
      throw new Error(`Mesh node with label "${nodeLabel}" not found`);
    }

    state.meshRefs.setSelectedIds([node.getId()]);
  }, label);
}

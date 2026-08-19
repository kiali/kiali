import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export type TopologyNode = {
  data: Record<string, unknown>;
  id: string;
  visible: boolean;
};

export type TopologyEdge = {
  data: Record<string, unknown>;
  id: string;
};

export type GraphTopology = {
  edges: TopologyEdge[];
  nodes: TopologyNode[];
};

type ComponentGraphState = Record<string, unknown>;

type GraphControllerOperation = { type: 'read' } | { type: 'scale'; factor: number; times: number };

/**
 * Read or mutate PF topology graph via React fiber.
 * TODO(#9712): Prefer DOM/data-test assertions when graph exposes stable test hooks.
 */
async function evaluateGraphPageComponent(
  page: Page,
  componentName: string,
  stateFilter: ComponentGraphState,
  operation: GraphControllerOperation
): Promise<GraphTopology | void> {
  return page.evaluate(
    ({ componentName: name, stateFilter: filter, operation: op }) => {
      const getReactFiber = (el: Element): unknown => {
        if ('_reactRootContainer' in el) {
          const container = (
            el as { _reactRootContainer?: { _internalRoot?: { current?: unknown }; current?: unknown } }
          )._reactRootContainer;
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
        props: Record<string, unknown>;
        state: unknown;
      };

      const buildNodeTree = (fiber: {
        child?: unknown;
        memoizedProps?: Record<string, unknown>;
        sibling?: unknown;
        type?: unknown;
      }): ReactTreeNode => {
        const name = getComponentName(fiber as { type?: unknown });
        const props = fiber.memoizedProps ? { ...fiber.memoizedProps } : {};
        delete props.children;
        const state = getStateFromFiber(fiber as { memoizedState?: unknown });
        const children: ReactTreeNode[] = [];
        let child = fiber.child as { child?: unknown; sibling?: unknown } | null;
        while (child) {
          children.push(buildNodeTree(child));
          child = child.sibling as typeof child;
        }
        return { name, props, state, children };
      };

      const matchComponentName = (selector: string, name: string): boolean => {
        if (!name) return false;
        if (selector === name) return true;
        const strippedName = name.includes('(')
          ? name
              .split('(')
              .find(s => s.includes(')'))
              ?.replace(/\)/g, '') || name
          : name;
        if (selector === strippedName) return true;
        if (selector.includes('*')) {
          const escapedParts = selector
            .split('*')
            .map(s => s.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1'))
            .join('.+');
          const regex = new RegExp(`^${escapedParts}$`);
          return regex.test(name) || regex.test(strippedName);
        }
        return false;
      };

      const partialMatch = (matcher: unknown, target: unknown, exact = false): boolean => {
        if (matcher === target) return true;
        if (matcher === undefined || matcher === null) return true;
        if (target === undefined || target === null) return false;
        if (exact) {
          return JSON.stringify(matcher) === JSON.stringify(target);
        }
        if (typeof matcher !== 'object') {
          return matcher === target;
        }
        if (Array.isArray(matcher)) {
          if (!Array.isArray(target)) return false;
          return matcher.every(item => (target as unknown[]).includes(item));
        }
        if (typeof target !== 'object') return false;
        return Object.keys(matcher as object).every(key => {
          if (!(key in (target as object))) return false;
          return partialMatch(
            (matcher as Record<string, unknown>)[key],
            (target as Record<string, unknown>)[key],
            exact
          );
        });
      };

      const findComponentsInTree = (
        tree: ReactTreeNode,
        selector: string,
        opts: { state?: Record<string, unknown> } = {}
      ): ReactTreeNode[] => {
        const results: ReactTreeNode[] = [];
        const stack: ReactTreeNode[] = [tree];
        while (stack.length) {
          const current = stack.pop()!;
          if (matchComponentName(selector, current.name)) {
            let matches = true;
            if (opts.state && !partialMatch(opts.state, current.state)) {
              matches = false;
            }
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
      const results = findComponentsInTree(tree, name, { state: filter });
      if (results.length !== 1) {
        throw new Error(`${name} not ready (found ${results.length})`);
      }
      const state = results[0].state as {
        graphRefs: {
          getController: () => {
            getElements: () => Array<{
              getData: () => Record<string, unknown>;
              getId: () => string;
              getKind: () => string;
              isVisible?: () => boolean;
            }>;
            hasGraph: () => boolean;
          };
        };
      };
      const controller = state.graphRefs.getController();
      if (!controller.hasGraph()) {
        throw new Error('Graph controller has no graph');
      }
      if (op.type === 'scale') {
        const graph = controller.getGraph();
        for (let i = 0; i < op.times; i++) {
          graph.scaleBy(op.factor);
        }
        return;
      }
      const elems = controller.getElements();
      const nodes: TopologyNode[] = [];
      const edges: TopologyEdge[] = [];
      const modelNode = 'node';
      const modelGroup = 'group';
      const modelEdge = 'edge';
      elems.forEach(el => {
        const kind = el.getKind?.();
        if (kind === modelNode || kind === modelGroup) {
          nodes.push({
            id: el.getId(),
            data: el.getData(),
            visible: el.isVisible?.() ?? true
          });
        } else if (kind === modelEdge) {
          edges.push({ id: el.getId(), data: el.getData() });
        }
      });
      return { nodes, edges };
    },
    { componentName, stateFilter, operation }
  );
}

async function readComponentGraphTopology(
  page: Page,
  componentName: string,
  stateFilter: ComponentGraphState
): Promise<GraphTopology> {
  return (await evaluateGraphPageComponent(page, componentName, stateFilter, { type: 'read' })) as GraphTopology;
}

export async function readGraphTopology(page: Page): Promise<GraphTopology> {
  return readComponentGraphTopology(page, 'GraphPageComponent', {
    graphData: { isLoading: false },
    isReady: true
  });
}

export async function scaleGraphBy(page: Page, factor = 4 / 3, times = 6): Promise<void> {
  await evaluateGraphPageComponent(
    page,
    'GraphPageComponent',
    {
      graphData: { isLoading: false },
      isReady: true
    },
    { type: 'scale', factor, times }
  );
}

export async function readMiniGraphTopology(page: Page): Promise<GraphTopology> {
  return readComponentGraphTopology(page, 'MiniGraphCardComponent', {
    isLoading: false,
    isReady: true
  });
}

export async function expectMiniGraphReady(page: Page): Promise<void> {
  await expect(page.locator('#MiniGraphCard[data-ready="true"]')).toBeVisible();
}

export async function expectGraphTopology(page: Page, assertFn: (topology: GraphTopology) => void): Promise<void> {
  let lastError: unknown;
  await expect
    .poll(async () => {
      try {
        const topology = await readGraphTopology(page);
        assertFn(topology);
        return true;
      } catch (error) {
        lastError = error;
        return false;
      }
    })
    .toBe(true);
  if (lastError) {
    throw lastError;
  }
}

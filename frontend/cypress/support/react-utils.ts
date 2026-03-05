export interface ReactNode {
  children: ReactNode[];
  isFragment: boolean;
  name: string;
  node: HTMLElement | null;
  props: any;
  state: any;
}

// Check if element is a React root (supports React 16, 17, and 18)
export const isReactRoot = (el: Element): boolean => {
  // React 16/17: _reactRootContainer
  if ('_reactRootContainer' in el) return true;
  // React 18: __reactContainer$ prefix
  return Object.keys(el).some(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
};

// Get React fiber from root element
export const getReactFiber = (el: Element): any => {
  // React 16/17
  if ('_reactRootContainer' in el) {
    const container = (el as any)._reactRootContainer;
    return container._internalRoot?.current || container.current;
  }
  // React 18: __reactContainer$
  const containerKey = Object.keys(el).find(k => k.startsWith('__reactContainer'));
  if (containerKey) {
    const container = (el as any)[containerKey];
    return container?.stateNode?.current || container;
  }
  // Fallback to __reactFiber$
  const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
  return fiberKey ? (el as any)[fiberKey] : null;
};

// Get component name from fiber
const getComponentName = (fiber: any): string => {
  if (!fiber?.type) return '';
  if (typeof fiber.type === 'string') return fiber.type;
  if (typeof fiber.type === 'function') {
    return fiber.type.displayName || fiber.type.name || '';
  }
  if (fiber.type?.displayName) return fiber.type.displayName;
  if (fiber.type?.name) return fiber.type.name;
  // React.memo, React.forwardRef wrapped components
  if (fiber.type?.render) {
    return fiber.type.render.displayName || fiber.type.render.name || '';
  }
  return '';
};

// Extract state from fiber (handles both class components and hooks)
const getStateFromFiber = (fiber: any): any => {
  if (!fiber?.memoizedState) return undefined;

  const memoizedState = fiber.memoizedState;

  // Class component: memoizedState is the state object directly
  if (memoizedState && typeof memoizedState === 'object') {
    // Check if it's NOT a hooks linked list (hooks have 'next' property)
    if (!('next' in memoizedState) && !('baseState' in memoizedState)) {
      return memoizedState;
    }
    // Hooks: baseState contains the actual state
    if ('baseState' in memoizedState && memoizedState.baseState !== undefined) {
      return memoizedState.baseState;
    }
  }

  // Functional component with hooks: traverse the hooks linked list
  let hook = memoizedState;
  while (hook) {
    if (hook.memoizedState !== undefined && hook.memoizedState !== null) {
      if (typeof hook.memoizedState !== 'object' || !('next' in hook.memoizedState)) {
        return hook.memoizedState;
      }
    }
    if (hook.baseState !== undefined) {
      return hook.baseState;
    }
    hook = hook.next;
  }

  return undefined;
};

// Find DOM node from fiber
const findDOMNode = (fiber: any): HTMLElement | null => {
  if (!fiber) return null;

  if (fiber.stateNode instanceof HTMLElement) {
    return fiber.stateNode;
  }

  // Search in children
  let child = fiber.child;
  while (child) {
    if (child.stateNode instanceof HTMLElement) {
      return child.stateNode;
    }
    const found = findDOMNode(child);
    if (found) return found;
    child = child.sibling;
  }

  return null;
};

// Build ReactNode tree from fiber
export const buildNodeTree = (fiber: any): ReactNode => {
  const name = getComponentName(fiber);
  const props = fiber?.memoizedProps ? { ...fiber.memoizedProps } : {};
  delete props.children;

  const state = getStateFromFiber(fiber);
  const node = findDOMNode(fiber);

  const children: ReactNode[] = [];
  let child = fiber?.child;
  while (child) {
    children.push(buildNodeTree(child));
    child = child.sibling;
  }

  return { name, node, isFragment: children.length > 1 && !node, state, props, children };
};

// Match component name (supports wildcards like *oint, MyComp*)
const matchComponentName = (selector: string, name: string): boolean => {
  if (!name) return false;
  if (selector === name) return true;

  // Strip HOC wrappers like "Connect(MyComponent)" -> "MyComponent"
  const strippedName = name.includes('(')
    ? name
        .split('(')
        .find(s => s.includes(')'))
        ?.replace(/\)/g, '') || name
    : name;

  if (selector === strippedName) return true;

  // Wildcard match
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

// Deep partial match for props/state
const partialMatch = (matcher: any, target: any, exact = false): boolean => {
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
    return matcher.every(item => target.includes(item));
  }

  if (typeof target !== 'object') return false;

  return Object.keys(matcher).every(key => {
    if (!(key in target)) return false;
    return partialMatch(matcher[key], target[key], exact);
  });
};

// Options for getReact() command
export interface ReactOpts {
  exact?: boolean;
  options?: { timeout?: number };
  props?: Record<string, any>;
  root?: string;
  state?: Record<string, any>;
}

// Find all matching components in tree
export const findComponentsInTree = (tree: ReactNode, selector: string, opts: ReactOpts = {}): ReactNode[] => {
  const results: ReactNode[] = [];
  const stack: ReactNode[] = [tree];

  while (stack.length) {
    const current = stack.pop()!;

    if (matchComponentName(selector, current.name)) {
      let matches = true;

      if (opts.props && !partialMatch(opts.props, current.props, opts.exact)) {
        matches = false;
      }

      if (opts.state && !partialMatch(opts.state, current.state, opts.exact)) {
        matches = false;
      }

      if (matches) {
        results.push(current);
      }
    }

    // Add children to stack (reverse order to maintain tree order)
    for (let i = current.children.length - 1; i >= 0; i--) {
      stack.push(current.children[i]);
    }
  }

  return results;
};

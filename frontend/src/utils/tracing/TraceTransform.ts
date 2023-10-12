import _isEqual from 'lodash/isEqual';
import { KeyValuePair, Span, SpanData, JaegerTrace, TraceData, RichSpanData } from 'types/TracingInfo';
import { extractSpanInfo, getWorkloadFromSpan } from './TracingHelper';

class TreeNode {
  value: string;
  children: any[];

  static iterFunction(fn, depth = 0) {
    return node => fn(node.value, node, depth);
  }

  static searchFunction(search) {
    if (typeof search === 'function') {
      return search;
    }

    return (value, node) => (search instanceof TreeNode ? node === search : value === search);
  }

  constructor(value, children = []) {
    this.value = value;
    this.children = children;
  }

  get depth() {
    return this.children.reduce((depth, child) => Math.max(child.depth + 1, depth), 1);
  }

  get size() {
    let i = 0;
    this.walk(() => i++);
    return i;
  }

  addChild(child) {
    this.children.push(child instanceof TreeNode ? child : new TreeNode(child));
    return this;
  }

  find(search) {
    const searchFn = TreeNode.iterFunction(TreeNode.searchFunction(search));
    if (searchFn(this)) {
      return this;
    }
    for (let i = 0; i < this.children.length; i++) {
      const result = this.children[i].find(search);
      if (result) {
        return result;
      }
    }
    return null;
  }

  getPath(search) {
    const searchFn = TreeNode.iterFunction(TreeNode.searchFunction(search));

    const findPath = (currentNode, currentPath) => {
      // skip if we already found the result
      const attempt = currentPath.concat([currentNode]);
      // base case: return the array when there is a match
      if (searchFn(currentNode)) {
        return attempt;
      }
      for (let i = 0; i < currentNode.children.length; i++) {
        const child = currentNode.children[i];
        const match = findPath(child, attempt);
        if (match) {
          return match;
        }
      }
      return null;
    };

    return findPath(this, []);
  }

  walk(fn, depth = 0) {
    const nodeStack: any[] = [];
    let actualDepth = depth;
    nodeStack.push({ node: this, depth: actualDepth });
    while (nodeStack.length) {
      const { node, depth: nodeDepth } = nodeStack.pop();
      fn(node.value, node, nodeDepth);
      actualDepth = nodeDepth + 1;
      let i = node.children.length - 1;
      while (i >= 0) {
        nodeStack.push({ node: node.children[i], depth: actualDepth });
        i--;
      }
    }
  }
}

function deduplicateTags(spanTags: Array<KeyValuePair>) {
  const warningsHash: Map<string, string> = new Map<string, string>();
  const tags: Array<KeyValuePair> = spanTags.reduce<Array<KeyValuePair>>((uniqueTags, tag) => {
    if (!uniqueTags.some(t => t.key === tag.key && t.value === tag.value)) {
      uniqueTags.push(tag);
    } else {
      warningsHash.set(`${tag.key}:${tag.value}`, `Duplicate tag "${tag.key}:${tag.value}"`);
    }
    return uniqueTags;
  }, []);
  const warnings = Array.from(warningsHash.values());
  return { tags, warnings };
}

export const TREE_ROOT_ID = '__root__';

export const spansSort = (a: SpanData, b: SpanData) =>
  +(a.startTime > b.startTime) || +(a.startTime === b.startTime) - 1;

export function getTraceSpanIdsAsTree(trace: TraceData<SpanData>) {
  const nodesById = new Map(trace.spans.map(span => [span.spanID, new TreeNode(span.spanID)]));
  const spansById = new Map(trace.spans.map(span => [span.spanID, span]));
  const root = new TreeNode(TREE_ROOT_ID);
  trace.spans.forEach(span => {
    const node = nodesById.get(span.spanID);
    if (Array.isArray(span.references) && span.references.length) {
      const { refType, spanID: parentID } = span.references[0];
      if (refType === 'CHILD_OF' || refType === 'FOLLOWS_FROM') {
        const parent = nodesById.get(parentID) || root;
        parent.children.push(node);
      } else {
        throw new Error(`Unrecognized ref type: ${refType}`);
      }
    } else {
      root.children.push(node);
    }
  });
  const comparator = (a, b) => spansSort(spansById.get(a.value)!, spansById.get(b.value)!);
  trace.spans.forEach(span => {
    const node: any = nodesById.get(span.spanID);
    if (node.children.length > 1) {
      node.children.sort(comparator);
    }
  });
  root.children.sort(comparator);
  return root;
}

/**
 * NOTE: Mutates `data` - Transform the HTTP response data into the form the app
 * generally requires.
 */
export function transformTraceData(data: TraceData<SpanData>, cluster?: string): JaegerTrace | null {
  let { traceID } = data;
  if (!traceID) {
    return null;
  }
  traceID = traceID.toLowerCase();

  let traceEndTime = 0;
  let traceStartTime = Number.MAX_SAFE_INTEGER;
  const spanIdCounts = new Map();
  const spanMap = new Map<string, RichSpanData>();
  // filter out spans with empty start times
  // eslint-disable-next-line no-param-reassign
  data.spans = data.spans.filter(span => Boolean(span.startTime));

  const max = data.spans.length;
  for (let i = 0; i < max; i++) {
    const span: Span = data.spans[i] as Span;
    const { startTime, duration, processID } = span;
    //
    let spanID = span.spanID;
    // check for start / end time for the trace
    if (startTime < traceStartTime) {
      traceStartTime = startTime;
    }
    if (startTime + duration > traceEndTime) {
      traceEndTime = startTime + duration;
    }
    // make sure span IDs are unique
    const idCount = spanIdCounts.get(spanID);
    if (idCount != null) {
      // eslint-disable-next-line no-console
      console.warn(`Dupe spanID, ${idCount + 1} x ${spanID}`, span, spanMap.get(spanID));
      if (_isEqual(span, spanMap.get(spanID))) {
        // eslint-disable-next-line no-console
        console.warn('\t two spans with same ID have `isEqual(...) === true`');
      }
      spanIdCounts.set(spanID, idCount + 1);
      spanID = `${spanID}_${idCount}`;
      span.spanID = spanID;
    } else {
      spanIdCounts.set(spanID, 1);
    }
    // For otel format traces
    if (typeof data.processes[processID] !== 'undefined') {
      span.process = data.processes[processID];
    }

    spanMap.set(spanID, transformSpanData(span, cluster));
  }
  // tree is necessary to sort the spans, so children follow parents, and
  // siblings are sorted by start time
  const tree = getTraceSpanIdsAsTree(data);
  const spans: RichSpanData[] = [];
  const svcCounts: Record<string, number> = {};
  let traceName = '';

  tree.walk((spanID: string, node: TreeNode, depth: number = 0) => {
    if (spanID === '__root__') {
      return;
    }
    const span = spanMap.get(spanID);
    if (!span) {
      return;
    }
    const { serviceName } = span.process;
    svcCounts[serviceName] = (svcCounts[serviceName] || 0) + 1;
    if ((!span.references || !span.references.length) && traceName === '') {
      traceName = span.operationName;
    }
    span.relativeStartTime = span.startTime - traceStartTime;
    span.depth = depth - 1;
    span.hasChildren = node.children.length > 0;
    span.references.forEach(ref => {
      const refSpan = spanMap.get(ref.spanID) as Span;
      if (refSpan) {
        // eslint-disable-next-line no-param-reassign
        ref.span = refSpan;
      }
    });
    spans.push(span);
  });
  const services = Object.keys(svcCounts).map(name => ({ name, numberOfSpans: svcCounts[name] }));
  return {
    services,
    spans,
    traceID,
    traceName,
    // can't use spread operator for intersection types
    // repl: https://goo.gl/4Z23MJ
    // issue: https://github.com/facebook/flow/issues/1511
    processes: data.processes,
    duration: traceEndTime - traceStartTime,
    startTime: traceStartTime,
    endTime: traceEndTime,
    matched: data.matched
  };
}

// Extracts some information from a span to make it suitable for table-display
export const transformSpanData = (span: Span, cluster?: string): RichSpanData => {
  span.warnings = span.warnings || [];
  span.tags = span.tags || [];
  span.references = span.references || [];
  const tagsInfo = deduplicateTags(span.tags);
  span.tags = tagsInfo.tags;
  span.warnings = span.warnings.concat(tagsInfo.warnings);
  const { type, info } = extractSpanInfo(span);
  const workloadNs = getWorkloadFromSpan(span);

  const split = span.process.serviceName.split('.');
  const app = split[0];
  const namespace = workloadNs ? workloadNs.namespace : split.length > 1 ? split[1] : undefined;
  if (!namespace) {
    console.warn('Could not determine span namespace');
  }

  const linkToApp = namespace ? '/namespaces/' + namespace + '/applications/' + app : undefined;
  const linkToWorkload = workloadNs
    ? '/namespaces/' + workloadNs.namespace + '/workloads/' + workloadNs.workload
    : undefined;
  return {
    ...span,
    type: type,
    info: info,
    component: info.component || 'unknown',
    namespace: namespace || 'unknown',
    app: app,
    linkToApp: linkToApp,
    workload: workloadNs?.workload,
    pod: workloadNs?.pod,
    linkToWorkload: linkToWorkload,
    cluster: cluster
  };
};

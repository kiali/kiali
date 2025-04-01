import { Controller, Edge, GraphElement, isEdge, isNode, Node, NodeModel } from '@patternfly/react-topology';
import { action } from 'mobx';
import { DecoratedGraphEdgeWrapper, DecoratedGraphElements, DecoratedGraphNodeWrapper } from 'types/Graph';

export const toSafeFieldName = (fieldName: string): string => {
  const alnumString = /^[a-zA-Z0-9]*$/;
  const unsafeChar = /[^a-zA-Z0-9]/g;

  if (fieldName.match(alnumString)) {
    return fieldName;
  }

  return fieldName.replace(unsafeChar, '_');
};

// It is common that when updating the graph that the element topology (nodes, edges) remain the same,
// only their activity changes (rates, etc). When the topology remains the same we may be able to optimize
// some behavior.  This returns true if the topology changes, false otherwise.
// 1) Quickly compare the number of nodes and edges, if different return true.
// 2) Compare the ids
export const elementsChanged = (
  prevElements: DecoratedGraphElements,
  nextElements: DecoratedGraphElements
): boolean => {
  if (prevElements === nextElements) {
    return false;
  }

  if (
    !prevElements ||
    !nextElements ||
    !prevElements.nodes ||
    !prevElements.edges ||
    !nextElements.nodes ||
    !nextElements.edges ||
    prevElements.nodes.length !== nextElements.nodes.length ||
    prevElements.edges.length !== nextElements.edges.length
  ) {
    return true;
  }

  return !(
    nodeOrEdgeArrayHasSameIds(nextElements.nodes, prevElements.nodes) &&
    nodeOrEdgeArrayHasSameIds(nextElements.edges, prevElements.edges)
  );
};

const nodeOrEdgeArrayHasSameIds = <T extends DecoratedGraphNodeWrapper | DecoratedGraphEdgeWrapper>(
  a: Array<T>,
  b: Array<T>
): boolean => {
  const aIds = a.map(e => e.data.id).sort();
  return b
    .map(e => e.data.id)
    .sort()
    .every((eId, index) => eId === aIds[index]);
};

//=======================================================================================================

// TODO: When/if it is fixed this can be replaced with a straight call to node.getAllNodeChildren();
// https://github.com/patternfly/patternfly-react/issues/8350
export const descendents = <E extends NodeModel = NodeModel, D = any>(node: Node<E, D>): Node<E, D>[] => {
  const result: Node[] = [];
  if (!node.isGroup()) {
    return result;
  }

  const children = node.getChildren().filter(e => isNode(e)) as Node[];
  result.push(...children.filter(child => !child.isGroup()));
  children.forEach(child => {
    if (child.isGroup()) {
      result.push(...descendents(child));
    }
  });
  return result;
};

// setObserved executes the provided setter func in a single mobx action. The setter is expected to make at least one element update.
// like a call to elem.setData() or elem.setVisible(). PFT has these updates wrapped in a mobx observer and wants changes wrapper
// in a mobx action. To limit renders, batch several data updates in one setDataFunc execution. If you see a console warning like
// "[MobX] Since strict-mode is enabled, changing (observed) observable values without using an action is not allowed",
// then you're missing this wrapper.
export const setObserved = (setter: () => void): void => {
  action(() => {
    setter();
  })();
};

export const elems = (c: Controller): { edges: Edge[]; nodes: Node[] } => {
  const elems = c.getElements();
  return {
    edges: elems.filter(e => isEdge(e)) as Edge[],
    nodes: elems.filter(e => isNode(e)) as Node[]
  };
};

export const ancestors = (node: Node): GraphElement[] => {
  const result: GraphElement[] = [];
  while (node.hasParent()) {
    const parent = node.getParent() as Node;
    result.push(parent);
    node = parent;
  }
  return result;
};

export type SelectOp =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | '!*='
  | '!$='
  | '!^='
  | '*='
  | '$='
  | '^='
  | 'falsy'
  | 'truthy';
export type SelectExp = {
  op?: SelectOp;
  prop: string;
  val?: any;
};
export type SelectAnd = SelectExp[];
export type SelectOr = SelectAnd[];

export const selectOr = (elems: GraphElement[], ors: SelectOr): GraphElement[] => {
  let result = [] as GraphElement[];
  ors.forEach(ands => {
    const andResult = selectAnd(elems, ands);
    result = Array.from(new Set([...result, ...andResult]));
  });
  return result;
};

export const selectAnd = (elems: GraphElement[], ands: SelectAnd): GraphElement[] => {
  let result = elems;
  ands.forEach(exp => (result = select(result, exp)));
  return result;
};

export const select = (elems: GraphElement[], exp: SelectExp): GraphElement[] => {
  return elems.filter(e => {
    let propVal = e.getData()[exp.prop];

    switch (exp.op) {
      case 'falsy':
        return !propVal;
      case 'truthy':
        return !!propVal;
      default:
        propVal = propVal ?? '';
    }

    switch (exp.op) {
      case '!=':
        return propVal !== exp.val;
      case '<':
        return propVal < exp.val;
      case '>':
        return propVal > exp.val;
      case '>=':
        return propVal >= exp.val;
      case '<=':
        return propVal <= exp.val;
      case '!*=':
        return !(propVal as string).includes(exp.val as string);
      case '!$=':
        return !(propVal as string).endsWith(exp.val as string);
      case '!^=':
        return !(propVal as string).startsWith(exp.val as string);
      case '*=':
        return (propVal as string).includes(exp.val as string);
      case '$=':
        return (propVal as string).endsWith(exp.val as string);
      case '^=':
        return (propVal as string).startsWith(exp.val as string);
      default:
        return propVal === exp.val;
    }
  });
};

export const edgesIn = (nodes: Node[], sourceNodes?: Node[]): Edge[] => {
  const result = [] as Edge[];
  nodes.forEach(n =>
    result.push(...n.getTargetEdges().filter(e => !sourceNodes || sourceNodes.includes(e.getSource())))
  );
  return result;
};

export const edgesOut = (nodes: Node[], destNodes?: Node[]): Edge[] => {
  const result = [] as Edge[];
  nodes.forEach(n => result.push(...n.getSourceEdges().filter(e => !destNodes || destNodes.includes(e.getTarget()))));
  return result;
};

export const edgesInOut = (nodes: Node[]): Edge[] => {
  const result = edgesIn(nodes);
  result.push(...edgesOut(nodes));
  return Array.from(new Set(result));
};

export const nodesIn = (nodes: Node[]): Node[] => {
  const result = [] as Node[];
  edgesIn(nodes).forEach(e => result.push(e.getSource()));
  return Array.from(new Set(result));
};

export const nodesOut = (nodes: Node[]): Node[] => {
  const result = [] as Node[];
  edgesOut(nodes).forEach(e => result.push(e.getTarget()));
  return Array.from(new Set(result));
};

export const predecessors = (node: Node, processed: GraphElement[]): GraphElement[] => {
  let result = [] as GraphElement[];
  const targetEdges = node.getTargetEdges();
  const sourceNodes = targetEdges.map(e => e.getSource());
  result = result.concat(targetEdges, sourceNodes);

  sourceNodes.forEach(n => {
    if (processed.indexOf(n) === -1) {
      // Processed nodes is used to avoid infinite loops
      processed = processed.concat(n);
      result = result.concat(predecessors(n, processed));
    }
  });

  return result;
};

export const successors = (node: Node, processed: GraphElement[]): GraphElement[] => {
  let result = [] as GraphElement[];
  const sourceEdges = node.getSourceEdges();
  const targetNodes = sourceEdges.map(e => e.getTarget());
  result = result.concat(sourceEdges, targetNodes);
  targetNodes.forEach(n => {
    if (processed.indexOf(n) === -1) {
      // Processed nodes is used to avoid infinite loops
      processed = processed.concat(n);
      result = result.concat(successors(n, processed));
    }
  });
  return result;
};

export const leafNodes = (nodes: Node[]): Node[] => {
  return nodes.filter(n => n.getSourceEdges().length === 0);
};
